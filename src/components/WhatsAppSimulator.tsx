import React, { useState } from 'react';
import { MessageSquare, Send, CheckCheck, User, Bot, ShoppingBag, ShieldCheck, HelpCircle, ArrowRight, UserCheck } from 'lucide-react';
import { Conversation, Product } from '../types.js';

interface WhatsAppSimulatorProps {
  conversations: Conversation[];
  products: Product[];
  onSendMessage: (text: string, options?: { productRetailerId?: string; buttonId?: string }) => Promise<void>;
  isSending: boolean;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  conversations,
  products,
  onSendMessage,
  isSending,
}) => {
  const [inputText, setInputText] = useState('');
  const activeConversation = conversations[0] || null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const msg = inputText;
    setInputText('');
    await onSendMessage(msg);
  };

  const quickPrompts = [
    { label: '🛍️ "Quero ver tênis"', text: 'Quero ver tênis', desc: 'Dispara Single Product Message do catálogo' },
    { label: '📋 "Ver catálogo"', text: 'Ver catálogo de produtos', desc: 'Dispara Multi-Product Message em seções' },
    { label: '👨‍💼 "Falar com atendente"', text: 'Preciso falar com um atendente humano', desc: 'Dispara Handoff para HUMAN_QUEUE' },
    { label: '👋 "Olá / Menu"', text: 'Olá, bom dia!', desc: 'Dispara Menu Interativo de Boas-vindas' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="whatsapp-simulator-container">
      {/* Left Control Panel & Webhook Simulator */}
      <div className="lg:col-span-6 space-y-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Simulador de Webhooks WhatsApp</h3>
              <p className="text-xs text-slate-500 font-mono">POST /webhooks/meta (Cloud API)</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 my-3 leading-relaxed">
            Ao digitar uma mensagem abaixo ou clicar nos atalhos, o frontend dispara uma requisição idêntica ao payload real do Webhook da Meta. O endpoint <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">/webhooks/meta</code> valida a assinatura, enfileira na fila <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">whatsapp-inbound</code> e o Worker executa a máquina de estados.
          </p>

          {/* Quick Simulation Buttons */}
          <div className="space-y-2 mb-4">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Disparadores de Intenção do Bot:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(p.text)}
                  disabled={isSending}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition group disabled:opacity-50"
                >
                  <div className="font-semibold text-xs text-slate-800 group-hover:text-emerald-700">{p.label}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form input */}
          <form onSubmit={handleSend} className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Mensagem personalizada do cliente:
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ex: Gostaria de saber o valor do relógio smartwatch..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Enviar</span>
              </button>
            </div>
          </form>
        </div>

        {/* State Machine Info Card */}
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 text-slate-200">
          <h4 className="font-bold text-white text-sm flex items-center space-x-2 mb-2">
            <Bot className="h-4 w-4 text-emerald-400" />
            <span>Fluxos Ativos do Bot & Handoff</span>
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
              <span><strong>Single Product Message:</strong> Envia o objeto nativo <code className="text-emerald-300">interactive: product</code> com foto, preço e botão que abre o item direto no WhatsApp.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
              <span><strong>Multi-Product Message:</strong> Envia <code className="text-emerald-300">interactive: product_list</code> agrupando até 30 SKUs em seções.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span>
              <span><strong>Transição Humana:</strong> Ao acionar atendente, o bot altera o estado para <code className="text-amber-300 font-mono">HUMAN_QUEUE</code> e silencia as respostas automáticas.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right: Phone Mockup Simulation */}
      <div className="lg:col-span-6 flex justify-center">
        <div className="w-full max-w-[370px] bg-slate-800 p-3 rounded-[36px] shadow-2xl border-4 border-slate-700">
          {/* Phone Screen */}
          <div className="bg-[#EFEAE2] rounded-[28px] overflow-hidden flex flex-col h-[580px] shadow-inner relative">
            {/* WhatsApp App Header */}
            <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                  🛍️
                </div>
                <div>
                  <div className="font-semibold text-xs flex items-center space-x-1">
                    <span>Loja Oficial</span>
                    <ShieldCheck className="h-3 w-3 text-emerald-300 inline" />
                  </div>
                  <div className="text-[10px] text-emerald-200">
                    {activeConversation?.state === 'HUMAN_QUEUE' ? (
                      <span className="text-amber-200 font-semibold animate-pulse">● Aguardando Operador Humano</span>
                    ) : (
                      <span>WhatsApp Business Verificado</span>
                    )}
                  </div>
                </div>
              </div>

              {activeConversation && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20 text-white font-mono">
                  {activeConversation.state}
                </span>
              )}
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
              <div className="text-center my-1">
                <span className="bg-white/80 text-slate-500 text-[10px] px-2.5 py-0.5 rounded-full shadow-2xs font-medium">
                  Mensagens protegidas pela Meta Cloud API
                </span>
              </div>

              {activeConversation?.messages.map((msg, index) => {
                const isInbound = msg.direction === 'INBOUND';

                return (
                  <div
                    key={`${msg.id || 'msg'}-${msg.wamid || index}-${index}`}
                    className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-2.5 shadow-2xs relative ${
                        isInbound
                          ? 'bg-white text-slate-800 rounded-tl-none'
                          : 'bg-[#DCF8C6] text-slate-800 rounded-tr-none'
                      }`}
                    >
                      {/* Standard text body */}
                      <div className="text-xs whitespace-pre-wrap leading-relaxed">{msg.body}</div>

                      {/* Render Single Product Card inside Chat */}
                      {msg.type === 'PRODUCT' && (
                        <div className="mt-2 bg-white rounded-lg p-2 border border-slate-200 shadow-2xs">
                          <img
                            src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80"
                            alt="Tênis"
                            className="w-full h-24 object-cover rounded-md mb-1.5"
                          />
                          <div className="font-bold text-xs text-slate-900">Tênis Running Ultralight Azul 42</div>
                          <div className="text-emerald-700 font-bold text-xs mt-0.5">R$ 299,90</div>
                          <button
                            type="button"
                            className="w-full mt-2 py-1 bg-slate-100 hover:bg-slate-200 text-emerald-800 font-semibold text-[11px] rounded flex items-center justify-center space-x-1"
                          >
                            <ShoppingBag className="h-3 w-3" />
                            <span>Ver Detalhes do Produto</span>
                          </button>
                        </div>
                      )}

                      {/* Render Multi Product Card inside Chat */}
                      {msg.type === 'PRODUCT_LIST' && (
                        <div className="mt-2 bg-white rounded-lg p-2 border border-slate-200 shadow-2xs">
                          <div className="font-semibold text-xs text-slate-900 flex items-center space-x-1.5 text-emerald-700">
                            <ShoppingBag className="h-3.5 w-3.5" />
                            <span>Catálogo Comercial Meta</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">4 produtos disponíveis para compra imediata.</p>
                          <button
                            type="button"
                            className="w-full mt-2 py-1.5 bg-emerald-600 text-white font-semibold text-[11px] rounded flex items-center justify-center space-x-1 shadow-xs"
                          >
                            <span>Navegar pelos Produtos</span>
                          </button>
                        </div>
                      )}

                      {/* Render Quick Buttons */}
                      {msg.type === 'INTERACTIVE_BUTTON' && (
                        <div className="mt-2 space-y-1">
                          <button
                            type="button"
                            onClick={() => onSendMessage('Ver catálogo')}
                            className="w-full py-1 text-center bg-white border border-slate-200 text-emerald-700 font-medium text-[11px] rounded hover:bg-slate-50"
                          >
                            🛍️ Ver Catálogo
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendMessage('Quais os prazos de frete?')}
                            className="w-full py-1 text-center bg-white border border-slate-200 text-emerald-700 font-medium text-[11px] rounded hover:bg-slate-50"
                          >
                            📦 Prazos e Frete
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendMessage('Falar com atendente')}
                            className="w-full py-1 text-center bg-white border border-slate-200 text-emerald-700 font-medium text-[11px] rounded hover:bg-slate-50"
                          >
                            👨‍💼 Falar com Humano
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] text-slate-400">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {!isInbound && <CheckCheck className="h-3 w-3 text-blue-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Fake Input */}
            <div className="bg-white p-2 border-t border-slate-200 flex items-center space-x-2">
              <input
                type="text"
                disabled
                placeholder="Simulação de chat WhatsApp..."
                className="flex-1 bg-slate-100 rounded-full px-3 py-1.5 text-xs text-slate-400 outline-none"
              />
              <div className="w-7 h-7 rounded-full bg-[#075E54] flex items-center justify-center text-white">
                <Send className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
