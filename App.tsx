import React, { useState, useCallback } from 'react';
import { Crawler } from './services/crawler';
import Terminal from './components/Terminal';
import StatsCard from './components/StatsCard';
import { LogEntry, AppState, CrawlStats, LogLevel } from './types';

function App() {
  const [url, setUrl] = useState('https://example.com');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<CrawlStats>({
    pagesScanned: 0,
    assetsFound: 0,
    assetsDownloaded: 0,
    totalSize: 0
  });

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const updateStats = useCallback((newStats: CrawlStats) => {
    setStats(newStats);
  }, []);

  const handleStart = async () => {
    if (!url) return;
    
    // Reset
    setLogs([]);
    setStats({ pagesScanned: 0, assetsFound: 0, assetsDownloaded: 0, totalSize: 0 });
    setAppState(AppState.CRAWLING);

    try {
      const crawler = new Crawler({
        url,
        onLog: addLog,
        onStatsUpdate: updateStats
      });
      
      await crawler.start();
      setAppState(AppState.FINISHED);
    } catch (error) {
      setAppState(AppState.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            SiteRipper
          </h1>
          <p className="text-slate-400 text-lg">
            Turn any website into a standalone ZIP archive.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-globe text-slate-500"></i>
              </div>
              <input 
                type="url" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-white placeholder-slate-500 outline-none transition"
                disabled={appState === AppState.CRAWLING}
              />
            </div>
            <button
              onClick={handleStart}
              disabled={appState === AppState.CRAWLING || !url}
              className={`px-8 py-3 rounded-lg font-bold shadow-lg transition flex items-center justify-center gap-2
                ${appState === AppState.CRAWLING 
                  ? 'bg-slate-700 cursor-not-allowed text-slate-400' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transform hover:scale-105 active:scale-95'
                }`}
            >
              {appState === AppState.CRAWLING ? (
                <><i className="fas fa-spinner fa-spin"></i> Processing...</>
              ) : (
                <><i className="fas fa-download"></i> Extract Source</>
              )}
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            <span>Uses public CORS proxies. Large sites may fail due to proxy limits. Educational use only.</span>
          </div>
        </div>

        {/* Stats Grid */}
        <StatsCard stats={stats} />

        {/* Terminal Output */}
        <Terminal logs={logs} />
        
        {/* Footer */}
        <footer className="text-center text-slate-600 text-sm">
           SiteRipper v1.0 &bull; Runs entirely in your browser &bull; No Backend
        </footer>
      </div>
    </div>
  );
}

export default App;
