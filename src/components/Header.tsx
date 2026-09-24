import React from 'react';
import { Layers, Database, KeyRound, Radio, RefreshCw } from 'lucide-react';
import { QueueMetrics } from '../types.js';

interface HeaderProps {
  metrics: QueueMetrics | null;
  activeTab: string;
  onTabChange?: (tab: string) => void;
  onSelectTab?: (tab: string) => void;
  onQuickSimulate?: (type: 'whatsapp_message' | 'catalog_delta' | 'instagram_reel') => void;
  onSimulate?: (type: 'whatsapp_message' | 'catalog_delta' | 'instagram_reel') => void;
  isSimulating?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  metrics,
  activeTab,
  onTabChange,
  onSelectTab,
  onQuickSimulate,
  onSimulate,
  isSimulating = false,
  isRefreshing = false,
  onRefresh,
}) => {
  const handleTabClick = (tabId: string) => {
    if (typeof onSelectTab === 'function') {
      onSelectTab(tabId);
    } else if (typeof onTabChange === 'function') {
      onTabChange(tabId);
    }
  };

  const handleSimulate = (type: 'whatsapp_message' | 'catalog_delta' | 'instagram_reel') => {
    if (typeof onSimulate === 'function') {
      onSimulate(type);
    } else if (typeof onQuickSimulate === 'function') {
      onQuickSimulate(type);
    }
  };

  const tabs = [
    { id: 'queues', label: 'Filas BullMQ & Logs', badge: metrics ? metrics.whatsapp.active + metrics.catalog.active + metrics.instagram.active : 0 },
    { id: 'catalog', label: 'Catálogo & Meta Commerce', badge: undefined },
    { id: 'whatsapp', label: 'WhatsApp Bot & Atendimento Humano', badge: undefined },
    { id: 'instagram', label: 'Instagram Publisher', badge: undefined },
    { id: 'blueprint', label: 'Arquitetura & Docs Meta', badge: undefined },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm" id="main-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-slate-100 text-base tracking-tight">Meta Omnichannel Hub</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                Fastify Backend Online
              </span>
            </div>
            <p className="text-xs text-slate-400">Node.js TypeScript • Prisma PostgreSQL • BullMQ Redis</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1 rounded-md border border-slate-700/60 text-slate-300">
            <Database className="h-3.5 w-3.5 text-blue-400" />
            <span>PostgreSQL: <strong>Prisma Active</strong></span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1 rounded-md border border-slate-700/60 text-slate-300">
            <Radio className="h-3.5 w-3.5 text-amber-400" />
            <span>BullMQ: <strong>3 Filas Ativas</strong></span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1 rounded-md border border-slate-700/60 text-slate-300">
            <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
            <span>Meta Token: <strong>System User</strong></span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 transition"
              title="Atualizar dados"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span>Atualizar</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 pt-2">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-none" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => handleTabClick(tab.id)}
                className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center space-x-2 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-xs font-semibold bg-amber-400 text-slate-900 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center space-x-2 pb-2">
          <span className="text-xs text-slate-400 font-medium hidden md:inline">Testar Fila:</span>
          <button
            id="quick-sim-wa"
            disabled={isSimulating}
            onClick={() => handleSimulate('whatsapp_message')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition disabled:opacity-50"
          >
            + Msg WhatsApp
          </button>
          <button
            id="quick-sim-catalog"
            disabled={isSimulating}
            onClick={() => handleSimulate('catalog_delta')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 transition disabled:opacity-50"
          >
            + Delta Catálogo
          </button>
          <button
            id="quick-sim-ig"
            disabled={isSimulating}
            onClick={() => handleSimulate('instagram_reel')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-fuchsia-600/20 text-fuchsia-300 hover:bg-fuchsia-600/30 border border-fuchsia-500/30 transition disabled:opacity-50"
          >
            + Post Reels
          </button>
        </div>
      </div>
    </header>
  );
};
