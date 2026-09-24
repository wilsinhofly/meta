import React, { useState } from 'react';
import { RefreshCw, Play, CheckCircle2, Clock, AlertTriangle, MessageSquare, ShoppingBag, Instagram, ArrowRight, Zap, Check } from 'lucide-react';
import { QueueJobItem, QueueMetrics } from '../types.js';

interface QueueMonitorProps {
  metrics: QueueMetrics | null;
  jobs: QueueJobItem[];
  onRefresh: () => void;
  onRetry: (queueName: string, jobId: string) => void;
  onSimulate: (type: 'whatsapp_message' | 'catalog_delta' | 'instagram_reel') => void;
  isRefreshing: boolean;
}

export const QueueMonitor: React.FC<QueueMonitorProps> = ({
  metrics,
  jobs,
  onRefresh,
  onRetry,
  onSimulate,
  isRefreshing,
}) => {
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<QueueJobItem | null>(null);

  const filteredJobs = selectedQueueFilter === 'all'
    ? jobs
    : jobs.filter((j) => j.queueName === selectedQueueFilter);

  const queueCards = [
    {
      id: 'whatsapp-inbound',
      title: 'whatsapp-inbound',
      icon: MessageSquare,
      color: 'emerald',
      description: 'Ingestão de webhooks em <50ms, deduplicação por wamid e máquina de estados.',
      stats: metrics?.whatsapp || { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 },
    },
    {
      id: 'catalog-sync',
      title: 'catalog-sync',
      icon: ShoppingBag,
      color: 'blue',
      description: 'Deltas de produtos, agrupamento em lote e envio à Meta Commerce Batch API.',
      stats: metrics?.catalog || { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 },
    },
    {
      id: 'instagram-publisher',
      title: 'instagram-publisher',
      icon: Instagram,
      color: 'fuchsia',
      description: 'Pipeline 2 fases: container assíncrono, polling de status e publicação no feed.',
      stats: metrics?.instagram || { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 },
    },
  ];

  return (
    <div className="space-y-6" id="queue-monitor-container">
      {/* Top Banner and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Monitoramento de Filas BullMQ (Redis)</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Arquitetura Assíncrona Desacoplada
            </span>
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Cada canal opera em worker e fila isolados, garantindo que picos de mensagens no WhatsApp não bloqueiem publicações de vídeo no Instagram.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="refresh-queues-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 3 Queue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {queueCards.map((q) => {
          const Icon = q.icon;
          const isSelected = selectedQueueFilter === q.id;

          const colorClasses = {
            emerald: {
              border: isSelected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-emerald-300',
              badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              iconBg: 'bg-emerald-600 text-white',
            },
            blue: {
              border: isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-300',
              badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
              iconBg: 'bg-blue-600 text-white',
            },
            fuchsia: {
              border: isSelected ? 'border-fuchsia-500 ring-2 ring-fuchsia-200' : 'border-slate-200 hover:border-fuchsia-300',
              badgeBg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
              iconBg: 'bg-fuchsia-600 text-white',
            },
          }[q.color as 'emerald' | 'blue' | 'fuchsia'];

          return (
            <div
              key={q.id}
              onClick={() => setSelectedQueueFilter(selectedQueueFilter === q.id ? 'all' : q.id)}
              className={`bg-white rounded-xl p-5 border cursor-pointer transition-all duration-200 shadow-xs flex flex-col justify-between ${colorClasses.border}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${colorClasses.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{q.title}</h3>
                      <span className="text-xs text-slate-400 font-mono">queue:{q.id}</span>
                    </div>
                  </div>
                  {q.stats.active > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
                      Processando...
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                  {q.description}
                </p>

                {/* Counters Grid */}
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <span className="block text-xs font-medium text-slate-400">Espera</span>
                    <span className="text-sm font-bold text-slate-700">{q.stats.waiting}</span>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <span className="block text-xs font-medium text-amber-600">Ativo</span>
                    <span className="text-sm font-bold text-amber-700">{q.stats.active}</span>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <span className="block text-xs font-medium text-emerald-600">Sucesso</span>
                    <span className="text-sm font-bold text-emerald-700">{q.stats.completed}</span>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2">
                    <span className="block text-xs font-medium text-rose-600">Falhas</span>
                    <span className="text-sm font-bold text-rose-700">{q.stats.failed}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Clique para filtrar jobs</span>
                <span className="font-semibold text-slate-700">Total: {q.stats.total}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Jobs Log Table and Detail Drawer */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <h3 className="font-bold text-slate-900 text-base">Histórico de Execuções Recentes</h3>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredJobs.length} jobs registrados
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Filtro:</span>
            <select
              value={selectedQueueFilter}
              onChange={(e) => setSelectedQueueFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas as 3 Filas</option>
              <option value="whatsapp-inbound">Fila: whatsapp-inbound</option>
              <option value="catalog-sync">Fila: catalog-sync</option>
              <option value="instagram-publisher">Fila: instagram-publisher</option>
            </select>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Nenhum job registrado nesta fila ainda</p>
            <p className="text-xs text-slate-400 mt-1">Dispare uma simulação rápida no menu superior para ver a execução em tempo real.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-150 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Fila</th>
                  <th className="py-3 px-4">Nome do Job / Ação</th>
                  <th className="py-3 px-4">Tentativas</th>
                  <th className="py-3 px-4">Duração / Data</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredJobs.map((job) => {
                  const statusBadges = {
                    waiting: { bg: 'bg-slate-100 text-slate-600', icon: Clock, label: 'Em Espera' },
                    active: { bg: 'bg-amber-100 text-amber-800', icon: RefreshCw, label: 'Executando' },
                    completed: { bg: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2, label: 'Concluído' },
                    failed: { bg: 'bg-rose-100 text-rose-800', icon: AlertTriangle, label: 'Falhou' },
                  }[job.status];

                  const StatusIcon = statusBadges.icon;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadges.bg}`}>
                          <StatusIcon className={`h-3 w-3 ${job.status === 'active' ? 'animate-spin' : ''}`} />
                          <span>{statusBadges.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {job.queueName}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{job.name}</div>
                        <div className="text-slate-400 font-mono text-[11px] truncate max-w-xs">{job.id}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-slate-600">{job.attempts}x</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-700 font-medium">
                          {new Date(job.createdAt).toLocaleTimeString()}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {job.completedAt ? `${job.completedAt - job.createdAt}ms` : 'Em andamento'}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="px-2.5 py-1 text-xs font-medium rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition"
                        >
                          Ver Payload
                        </button>
                        {job.status === 'failed' && (
                          <button
                            onClick={() => onRetry(job.queueName, job.id)}
                            className="px-2.5 py-1 text-xs font-medium rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload Modal / Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h4 className="font-bold text-slate-900 text-base">Detalhes do Job BullMQ</h4>
                <p className="text-xs text-slate-500 font-mono">{selectedJob.id}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Payload de Entrada:</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto">
                  {JSON.stringify(selectedJob.data, null, 2)}
                </pre>
              </div>

              {selectedJob.result && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Resultado retornado pelo Worker:</span>
                  <pre className="p-3 bg-slate-900 text-blue-300 rounded-lg text-xs font-mono overflow-x-auto">
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </div>
              )}

              {selectedJob.error && (
                <div>
                  <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block mb-1">Erro da Execução:</span>
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-mono">
                    {selectedJob.error}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
