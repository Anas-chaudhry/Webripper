import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { fetchWithProxy } from './proxy';
import { Asset, LogEntry, LogLevel, CrawlStats } from '../types';

interface CrawlerOptions {
  url: string;
  onLog: (entry: LogEntry) => void;
  onStatsUpdate: (stats: CrawlStats) => void;
}

export class Crawler {
  private url: URL;
  private onLog: (entry: LogEntry) => void;
  private onStatsUpdate: (stats: CrawlStats) => void;
  private visitedUrls = new Set<string>();
  private assets = new Map<string, Asset>();
  private stats: CrawlStats = {
    pagesScanned: 0,
    assetsFound: 0,
    assetsDownloaded: 0,
    totalSize: 0,
  };
  private zip: JSZip;

  constructor(options: CrawlerOptions) {
    try {
      this.url = new URL(options.url);
    } catch (e) {
      throw new Error("Invalid URL provided");
    }
    this.onLog = options.onLog;
    this.onStatsUpdate = options.onStatsUpdate;
    this.zip = new JSZip();
  }

  private log(message: string, level: LogLevel = LogLevel.INFO) {
    this.onLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      message,
      level,
    });
  }

  private updateStats(update: Partial<CrawlStats>) {
    this.stats = { ...this.stats, ...update };
    this.onStatsUpdate(this.stats);
  }

  /**
   * Main entry point
   */
  public async start() {
    this.log(`Starting crawl for ${this.url.href}...`, LogLevel.INFO);
    
    try {
      // 1. Fetch Main HTML
      const htmlContent = await this.fetchText(this.url.href);
      this.log("Main HTML downloaded successfully.", LogLevel.SUCCESS);
      this.updateStats({ pagesScanned: 1 });

      // 2. Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // 3. Set Base URL for relative path resolution
      const baseTag = doc.querySelector('base');
      const baseUrl = baseTag ? new URL(baseTag.href, this.url.href).href : this.url.href;

      // 4. Scan for Assets
      await this.processAssets(doc, baseUrl);

      // 5. Rewrite HTML
      this.rewriteHtml(doc);

      // 6. Add index.html to Zip
      const serializer = new XMLSerializer();
      const finalHtml = serializer.serializeToString(doc);
      // Remove any <base> tag as we are making it offline relative
      const finalHtmlClean = finalHtml.replace(/<base[^>]*>/i, '');
      
      this.zip.file("index.html", finalHtmlClean);
      this.log("Generated index.html", LogLevel.SUCCESS);

      // 7. Generate Zip
      this.log("Compressing files...", LogLevel.INFO);
      const content = await this.zip.generateAsync({ type: "blob" });
      
      // 8. Trigger Download
      const safeName = this.url.hostname.replace(/[^a-z0-9]/gi, '_');
      
      // Fix for file-saver import issue on some CDNs
      // @ts-ignore
      const saveToDisk = FileSaver.saveAs || FileSaver;
      saveToDisk(content, `${safeName}_source.zip`);
      
      this.log("ZIP file downloaded!", LogLevel.SUCCESS);

    } catch (error: any) {
      this.log(`Crawl failed: ${error.message}`, LogLevel.ERROR);
      throw error;
    }
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetchWithProxy(url);
    const text = await res.text();
    this.updateStats({ totalSize: this.stats.totalSize + text.length });
    return text;
  }

  private async fetchBlob(url: string): Promise<Blob> {
    const res = await fetchWithProxy(url, true);
    const blob = await res.blob();
    this.updateStats({ totalSize: this.stats.totalSize + blob.size });
    return blob;
  }

  /**
   * Scans the document for linked resources and downloads them.
   */
  private async processAssets(doc: Document, baseUrl: string) {
    const elements = doc.querySelectorAll('img, link[rel="stylesheet"], script, video source, audio source');
    const assetQueue: { element: Element, url: string, type: Asset['type'] }[] = [];

    // Identify all needed assets first
    elements.forEach((el) => {
      let src = '';
      let type: Asset['type'] = 'other';

      if (el.tagName === 'LINK' && el.getAttribute('rel') === 'stylesheet') {
        src = el.getAttribute('href') || '';
        type = 'css';
      } else if (el.tagName === 'SCRIPT') {
        src = el.getAttribute('src') || '';
        type = 'js';
      } else if (el.tagName === 'IMG') {
        src = el.getAttribute('src') || '';
        type = 'image';
      } else if (el.tagName === 'SOURCE') {
        src = el.getAttribute('src') || '';
        type = 'video';
      }

      if (src && !src.startsWith('data:') && !src.startsWith('#')) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href;
          assetQueue.push({ element: el, url: absoluteUrl, type });
        } catch (e) {
          // invalid url, ignore
        }
      }
    });

    this.updateStats({ assetsFound: assetQueue.length });
    this.log(`Found ${assetQueue.length} linked assets. Downloading...`, LogLevel.INFO);

    // Process queue with concurrency limit to avoid overwhelming the browser/proxy
    const CONCURRENCY = 5;
    for (let i = 0; i < assetQueue.length; i += CONCURRENCY) {
        const chunk = assetQueue.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(item => this.downloadAsset(item.url, item.type)));
        
        // Minor delay to be nice to the network
        // await new Promise(r => setTimeout(r, 100));
    }
  }

  private async downloadAsset(url: string, type: Asset['type']) {
    if (this.visitedUrls.has(url)) return;
    this.visitedUrls.add(url);

    try {
      this.log(`Fetching ${url.substring(0, 50)}...`, LogLevel.INFO);
      
      const filename = this.getFilenameFromUrl(url, type);
      const folder = this.getFolderForType(type);
      const zipPath = `${folder}/${filename}`;

      let content: Blob | string;

      if (type === 'css') {
        // Special handling for CSS to find internal assets (fonts/images)
        const cssText = await this.fetchText(url);
        content = await this.processCssAssets(cssText, url);
      } else if (type === 'js') {
        content = await this.fetchText(url);
      } else {
        content = await this.fetchBlob(url);
      }

      this.assets.set(url, {
        originalUrl: url,
        filename,
        type,
        path: zipPath,
      });

      this.zip.file(zipPath, content);
      this.updateStats({ assetsDownloaded: this.stats.assetsDownloaded + 1 });

    } catch (e: any) {
      this.log(`Failed to download ${url}: ${e.message}`, LogLevel.WARNING);
    }
  }

  /**
   * Parses CSS content to find url(...) references (fonts, background images)
   * Downloads them and rewrites the CSS to point to local files.
   */
  private async processCssAssets(css: string, cssUrl: string): Promise<string> {
    const urlRegex = /url\((['"]?)(.*?)\1\)/g;
    let match;
    const assetsToDownload: { url: string, placeholder: string }[] = [];
    let processedCss = css;

    while ((match = urlRegex.exec(css)) !== null) {
      const originalRef = match[2];
      
      if (originalRef.startsWith('data:') || originalRef.startsWith('#')) continue;

      try {
        const absoluteUrl = new URL(originalRef, cssUrl).href;
        
        // Generate a filename for this sub-asset
        // We put css assets in a general 'assets' folder or 'images' depending on extension
        // For simplicity, we put them in 'assets'
        const filename = this.getFilenameFromUrl(absoluteUrl, 'other');
        const relativePath = `../assets/${filename}`; // Assuming css is in /css/ folder

        assetsToDownload.push({ url: absoluteUrl, placeholder: relativePath });
        
        // We download it, but we need to do it without blocking the main flow too much
        // Note: we can't easily await inside the replace loop in a clean way without splitting logic
        // So we gather first.
      } catch (e) {
          // ignore
      }
    }

    // Download CSS sub-assets
    for (const asset of assetsToDownload) {
        if (!this.visitedUrls.has(asset.url)) {
            this.visitedUrls.add(asset.url);
            try {
                const blob = await this.fetchBlob(asset.url);
                this.zip.file(`assets/${this.getFilenameFromUrl(asset.url, 'other')}`, blob);
                this.log(`Downloaded CSS asset: ${asset.url.substring(0, 30)}...`, LogLevel.INFO);
            } catch (e) {
                this.log(`Failed CSS asset: ${asset.url}`, LogLevel.WARNING);
            }
        }
        
        // Replace in CSS string
        // Note: this simple replace might be dangerous if the URL appears in text content, but standard for simple crawlers
        // A better approach is string splicing based on regex indices.
        // For this demo, we use a robust replaceAll approach if possible, but exact matching is key.
        
        // We need to escape special regex chars in the original URL if we use it in a RegExp
        // Or simply split/join
        processedCss = processedCss.split(asset.url).join(asset.placeholder);
        
        // Also handle the case where it was relative in the original CSS
        // This is tricky. We'll rely on the fact that we're replacing the *content* of the url() 
        // We iterate the matches again or do a smart replace. 
        // Actually, the simplest way for a demo is:
        // We know the resolved absolute URL. We don't easily know exactly what text was inside url().
        // So we will just leave it as is? No, that breaks offline.
        
        // REVISION: We must replace the specific match string.
        // Since we can't easily map back, we will skip complex CSS rewriting for this version 
        // and just try to replace the filename if it matches.
        // A robust CSS parser is too heavy. 
        // We will try to replace the exact string found in `match[2]`
    }
    
    // Simple pass to fix paths: 
    // We re-run regex, find the match, resolve it to absolute, see if we have a local path for it.
    processedCss = processedCss.replace(urlRegex, (match, quote, url) => {
        if (url.startsWith('data:') || url.startsWith('#')) return match;
        try {
             const abs = new URL(url, cssUrl).href;
             const filename = this.getFilenameFromUrl(abs, 'other');
             // If we are in /css/style.css, and assets are in /assets/
             return `url(${quote}../assets/${filename}${quote})`;
        } catch {
            return match;
        }
    });

    return processedCss;
  }

  private rewriteHtml(doc: Document) {
    // Rewrite <link rel="stylesheet">
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
      const href = el.getAttribute('href');
      if (href) {
        const abs = this.resolveUrl(href);
        const asset = this.assets.get(abs);
        if (asset) {
          el.setAttribute('href', `css/${asset.filename}`);
        }
      }
    });

    // Rewrite <script src>
    doc.querySelectorAll('script[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src) {
        const abs = this.resolveUrl(src);
        const asset = this.assets.get(abs);
        if (asset) {
          el.setAttribute('src', `js/${asset.filename}`);
        }
      }
    });

    // Rewrite <img src>
    doc.querySelectorAll('img[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src) {
        const abs = this.resolveUrl(src);
        const asset = this.assets.get(abs);
        if (asset) {
          el.setAttribute('src', `images/${asset.filename}`);
        }
      }
    });
    
    // Rewrite <video/source src>
    doc.querySelectorAll('source[src], video[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src) {
        const abs = this.resolveUrl(src);
        const asset = this.assets.get(abs);
        if (asset) {
          el.setAttribute('src', `assets/${asset.filename}`);
        }
      }
    });
  }

  private resolveUrl(rel: string): string {
    try {
        // We rely on the doc base URI being correct or manually resolving against stored base
        // Since we parsed the doc, its baseURI might be empty or about:blank
        return new URL(rel, this.url.href).href;
    } catch {
        return rel;
    }
  }

  private getFolderForType(type: Asset['type']): string {
    switch (type) {
      case 'css': return 'css';
      case 'js': return 'js';
      case 'image': return 'images';
      case 'font': return 'fonts';
      default: return 'assets';
    }
  }

  private getFilenameFromUrl(url: string, type: Asset['type']): string {
    try {
      const u = new URL(url);
      let name = u.pathname.split('/').pop() || `index`;
      // Remove query params if they exist in the name (sometimes happen)
      name = name.split('?')[0];
      
      // Ensure extension
      if (!name.includes('.')) {
        if (type === 'css') name += '.css';
        else if (type === 'js') name += '.js';
        else if (type === 'image') name += '.png';
        else name += '.dat';
      }
      
      // Handle duplicates? 
      // For this simple version, we trust the hash/query approach won't collide too much
      // or we just overwrite.
      return name;
    } catch {
      return `file_${Math.random().toString(36).substr(2, 5)}`;
    }
  }
}