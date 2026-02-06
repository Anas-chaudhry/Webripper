export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  level: LogLevel;
}

export interface Asset {
  originalUrl: string;
  filename: string;
  type: 'image' | 'css' | 'js' | 'font' | 'video' | 'other';
  content?: Blob | string;
  path: string; // Internal path in zip, e.g., "assets/img/logo.png"
}

export enum AppState {
  IDLE = 'IDLE',
  CRAWLING = 'CRAWLING',
  PROCESSING = 'PROCESSING',
  COMPRESSING = 'COMPRESSING',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR'
}

export interface CrawlStats {
  pagesScanned: number;
  assetsFound: number;
  assetsDownloaded: number;
  totalSize: number;
}
