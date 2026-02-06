import React from 'react';
import { CrawlStats } from '../types';

interface StatsCardProps {
  stats: CrawlStats;
}

const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Total Assets</div>
        <div className="text-2xl font-bold text-white mt-1">{stats.assetsFound}</div>
      </div>
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Downloaded</div>
        <div className="text-2xl font-bold text-cyan-400 mt-1">{stats.assetsDownloaded}</div>
      </div>
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Pages Processed</div>
        <div className="text-2xl font-bold text-purple-400 mt-1">{stats.pagesScanned}</div>
      </div>
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Total Size</div>
        <div className="text-2xl font-bold text-green-400 mt-1">{formatBytes(stats.totalSize)}</div>
      </div>
    </div>
  );
};

export default StatsCard;
