import React, { useEffect, useRef } from 'react';
import { LogEntry, LogLevel } from '../types';

interface TerminalProps {
  logs: LogEntry[];
}

const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.INFO: return 'text-slate-300';
      case LogLevel.SUCCESS: return 'text-green-400';
      case LogLevel.WARNING: return 'text-yellow-400';
      case LogLevel.ERROR: return 'text-red-500 font-bold';
      default: return 'text-slate-300';
    }
  };

  const getIcon = (level: LogLevel) => {
    switch (level) {
      case LogLevel.INFO: return '➜';
      case LogLevel.SUCCESS: return '✓';
      case LogLevel.WARNING: return '⚠';
      case LogLevel.ERROR: return '✗';
    }
  };

  return (
    <div className="w-full h-96 bg-[#1e1e1e] rounded-lg border border-slate-700 shadow-2xl overflow-hidden flex flex-col font-mono text-sm">
      <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-xs text-slate-400">Process Output</div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto terminal-scroll space-y-1">
        {logs.length === 0 && (
          <div className="text-slate-500 italic">Waiting for input...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-slate-500 select-none">
              {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}
            </span>
            <span className={`flex-1 break-all ${getColor(log.level)}`}>
              <span className="mr-2 opacity-70">{getIcon(log.level)}</span>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Terminal;
