import React, { useState } from 'react';
import { ShoppingBag, Plus, RefreshCw, CheckCircle, AlertCircle, Clock, ExternalLink, Code2, Layers, Check } from 'lucide-react';
import { Product } from '../types.js';

interface CatalogManagerProps {
  products: Product[];
  onRefresh: () => void;
  onSyncAll: () => Promise<void>;
  onSaveProduct: (productData: Partial<Product>) => Promise<void>;
  isSyncing: boolean;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({
  products,
  onRefresh,
  onSyncAll,
  onSaveProduct,
  isSyncing,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchJson, setShowBatchJson] = useState(false);
  const [form, setForm] = useState({
    retailerId: '',
    title: '',
    description: '',
    priceReais: '199.90',
    availability: 'in stock' as 'in stock' | 'out of stock',
    condition: 'new' as 'new' | 'refurbished' | 'used',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    url: 'https://sualoja.com.br/produtos/item',
    brand: 'MinhaMarca',
    category: 'Geral',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(form.priceReais.replace(',', '.')) * 100);
      await onSaveProduct({
        retailerId: form.retailerId.trim().toUpperCase(),
        title: form.title,
        description: form.description,
        price: priceCents,
        currency: 'BRL',
        availability: form.availability,
        condition: form.condition,
        imageUrl: form.imageUrl,
        url: form.url,
        brand: form.brand,
        category: form.category,
      });
      setShowAddModal(false);
      setForm({
        retailerId: '',
        title: '',
        description: '',
        priceReais: '199.90',
        availability: 'in stock',
        condition: 'new',
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
        url: 'https://sualoja.com.br/produtos/item',
        brand: 'MinhaMarca',
        category: 'Geral',
      });
    } finally {
      setSaving(false);
    }
  };

  // Payload que seria enviado à Meta Batch API
  const sampleBatchPayload = {
    requests: products.map((p) => ({
      method: 'UPDATE',
      retailer_id: p.retailerId,
      data: {
        title: p.title,
        description: p.description,
        availability: p.availability,
        condition: p.condition,
        price: p.price,
        currency: p.currency || 'BRL',
        url: p.url,
        image_url: p.imageUrl,
        brand: p.brand || 'MinhaMarca',
      },
    })),
  };

  return (
    <div className="space-y-6" id="catalog-manager-container">
      {/* Top Action Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Catálogo Único & Sincronização Meta Commerce</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Alimenta WhatsApp, Instagram e Facebook
            </span>
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Qualquer alteração feita aqui entra na fila <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono text-xs">catalog-sync</code> e é transmitida via Catalog Batch API para o Meta Commerce Manager.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowBatchJson(!showBatchJson)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition"
          >
            <Code2 className="h-4 w-4 text-slate-500" />
            <span>Ver Payload Batch API</span>
          </button>

          <a
            href="/api/catalog/export-feed"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition"
          >
            <ExternalLink className="h-4 w-4 text-slate-500" />
            <span>Feed XML (Reconciliação)</span>
          </a>

          <button
            onClick={onSyncAll}
            disabled={isSyncing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando Lote...' : 'Sincronizar Todos com Meta'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Batch JSON Inspector Drawer */}
      {showBatchJson && (
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 text-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-blue-400">POST https://graph.facebook.com/v21.0/{"{catalog_id}"}/batch</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Formato Oficial Meta Commerce</span>
            </div>
            <button
              onClick={() => setShowBatchJson(false)}
              className="text-xs text-slate-400 hover:text-slate-200 font-medium"
            >
              Fechar
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 mb-3">
            Este lote é montado automaticamente pela fila <span className="font-mono text-emerald-400">catalog-sync</span> e enviado com debouncing para otimizar requisições e evitar rate limits.
          </p>
          <pre className="p-3 bg-black/50 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-72">
            {JSON.stringify(sampleBatchPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* Product List Grid */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-slate-900 text-base">Produtos Cadastrados</h3>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {products.length} itens no catálogo
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-150 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4">SKU / Retailer ID</th>
                <th className="py-3 px-4">Preço (R$)</th>
                <th className="py-3 px-4">Disponibilidade</th>
                <th className="py-3 px-4">Meta Commerce Status</th>
                <th className="py-3 px-4">Canais Integrados</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {products.map((product) => {
                const isSynced = product.syncStatus === 'SYNCED';
                const isSyncingItem = product.syncStatus === 'SYNCING';
                const isFailed = product.syncStatus === 'FAILED';

                return (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 line-clamp-1">{product.title}</div>
                          <div className="text-[11px] text-slate-400">{product.category} • {product.brand}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {product.retailerId}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                      R$ {(product.price / 100).toFixed(2).replace('.', ',')}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {product.availability === 'in stock' ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Em Estoque</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>Esgotado</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {isSynced && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="h-3 w-3" />
                          <span>Sincronizado</span>
                        </span>
                      )}
                      {isSyncingItem && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          <span>Transmitindo Lote...</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          <AlertCircle className="h-3 w-3" />
                          <span>Falhou</span>
                        </span>
                      )}
                      {!isSynced && !isSyncingItem && !isFailed && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          <Clock className="h-3 w-3" />
                          <span>Pendente</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-600">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">WhatsApp</span>
                        <span className="px-1.5 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700 font-medium">Instagram Shop</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Facebook Shop</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          // Simula atualização rápida de estoque / preço
                          const newPrice = product.price === 29990 ? 27990 : 29990;
                          onSaveProduct({
                            retailerId: product.retailerId,
                            title: product.title,
                            price: newPrice,
                          });
                        }}
                        className="px-2.5 py-1 text-xs font-medium rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition"
                        title="Modifica o preço para testar o envio de delta automático à fila catalog-sync"
                      >
                        Alternar Preço (-R$20)
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-bold text-slate-900 text-base">Cadastrar Novo Produto no Catálogo</h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">SKU / Retailer ID (Único)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: SKU-BONE-PRETO"
                    value={form.retailerId}
                    onChange={(e) => setForm({ ...form, retailerId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Preço em R$</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 149.90"
                    value={form.priceReais}
                    onChange={(e) => setForm({ ...form, priceReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Título do Produto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Boné Aba Curva Streetwear"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Descrição Comercial</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Descrição que aparecerá no WhatsApp e nas tags de compra do Instagram..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Categoria</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Disponibilidade</label>
                  <select
                    value={form.availability}
                    onChange={(e) => setForm({ ...form, availability: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="in stock">Em Estoque (in stock)</option>
                    <option value="out of stock">Esgotado (out of stock)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">URL Pública da Imagem (HTTPS obrigatório para Meta)</label>
                <input
                  type="url"
                  required
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                >
                  {saving ? 'Enfileirando...' : 'Salvar & Sincronizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
