import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.js';
import { QueueMonitor } from './components/QueueMonitor.js';
import { CatalogManager } from './components/CatalogManager.js';
import { WhatsAppSimulator } from './components/WhatsAppSimulator.js';
import { InstagramPublisher } from './components/InstagramPublisher.js';
import { BlueprintDocs } from './components/BlueprintDocs.js';
import { Product, Conversation, InstagramPost, QueueJobItem, QueueMetrics } from './types.js';

async function fetchSafeJson(url: string, fallback: any) {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const text = await res.text();
    if (!text || !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      return fallback;
    }
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('queues');
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [jobs, setJobs] = useState<QueueJobItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch all initial data com parsing 100% seguro (nunca quebra por HTML ou 404)
  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [metricsRes, jobsRes, productsRes, convsRes, postsRes] = await Promise.all([
        fetchSafeJson('/api/queues/metrics', null),
        fetchSafeJson('/api/queues/jobs', { jobs: [] }),
        fetchSafeJson('/api/catalog/products', { products: [] }),
        fetchSafeJson('/api/whatsapp/conversations', { conversations: [] }),
        fetchSafeJson('/api/instagram/posts', { posts: [] }),
      ]);

      if (metricsRes) setMetrics(metricsRes);
      if (jobsRes?.jobs) setJobs(jobsRes.jobs);
      if (productsRes?.products) setProducts(productsRes.products);
      if (convsRes?.conversations) setConversations(convsRes.conversations);
      if (postsRes?.posts) setPosts(postsRes.posts);
    } catch {
      // Ignora silenciosamente
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData();
    // Polling contínuo de métricas e status a cada 3.5 segundos
    const interval = setInterval(() => {
      loadData();
    }, 3500);
    return () => clearInterval(interval);
  }, [loadData]);

  // Actions
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    showToast('Dados sincronizados com sucesso.');
  };

  const handleSimulateWebhook = async (type: 'whatsapp' | 'catalog' | 'instagram') => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/queues/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({}));
      showToast(`Evento simulado: ${data.message || 'Job enfileirado na BullMQ'}`);
      await loadData();
    } catch {
      showToast('Falha ao simular evento.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleUpdatePrice = async (sku: string, newPrice: number) => {
    try {
      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, price: newPrice }),
      });
      const data = await res.json().catch(() => ({}));
      showToast(`Preço do SKU ${sku} alterado para R$ ${newPrice.toFixed(2)}. Delta enfileirado.`);
      await loadData();
      return data;
    } catch {
      showToast('Erro ao atualizar produto.');
    }
  };

  const handleSyncAllCatalog = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/catalog/sync-all', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      showToast(`Sincronização em lote enfileirada: ${data.total || 0} produtos para Meta Commerce.`);
      await loadData();
    } catch {
      showToast('Erro ao sincronizar catálogo completo.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSchedulePost = async (postData: {
    mediaType: 'IMAGE' | 'REELS' | 'STORIES';
    caption: string;
    mediaUrl: string;
    scheduledFor?: string;
  }) => {
    try {
      const res = await fetch('/api/instagram/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });
      const data = await res.json().catch(() => ({}));
      showToast(data.message || 'Publicação enviada para o pipeline da Meta.');
      await loadData();
    } catch {
      showToast('Erro ao agendar publicação.');
    }
  };

  const handleSendWhatsAppMessage = async (to: string, message: string) => {
    try {
      await fetch('/api/queues/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'whatsapp',
          payload: { from: to, text: message },
        }),
      });
      showToast(`Mensagem enviada pelo cliente. Bot respondendo em segundo plano.`);
      await loadData();
    } catch {
      showToast('Erro ao simular envio de mensagem.');
    }
  };

  const handleRetryJob = async (queueName: string, jobId: string) => {
    try {
      const res = await fetch('/api/queues/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueName, jobId }),
      });
      const data = await res.json().catch(() => ({}));
      showToast(data.message || `Job ${jobId} reenfileirado.`);
      await loadData();
    } catch {
      showToast('Erro ao reenfileirar job.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-xs border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        metrics={metrics}
        isRefreshing={isRefreshing}
        onRefresh={handleManualRefresh}
        onSimulate={handleSimulateWebhook}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'queues' && (
          <QueueMonitor
            metrics={metrics}
            jobs={jobs}
            onRetryJob={handleRetryJob}
            isRefreshing={isRefreshing}
            onRefresh={handleManualRefresh}
            onSimulate={handleSimulateWebhook}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogManager
            products={products}
            onUpdatePrice={handleUpdatePrice}
            onSyncAll={handleSyncAllCatalog}
            isSyncing={isSyncing}
          />
        )}

        {activeTab === 'whatsapp' && (
          <WhatsAppSimulator
            conversations={conversations}
            products={products}
            onSendMessage={handleSendWhatsAppMessage}
          />
        )}

        {activeTab === 'instagram' && (
          <InstagramPublisher
            posts={posts}
            onSchedulePost={handleSchedulePost}
            isPublishing={isSimulating}
          />
        )}

        {activeTab === 'docs' && <BlueprintDocs />}
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>Meta Omnichannel Commerce Hub • Fastify v5 • BullMQ • Prisma • Meta Graph API v21.0</p>
      </footer>
    </div>
  );
}
