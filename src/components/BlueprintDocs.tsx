import React, { useState, useEffect } from 'react';
import {
  Layers,
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  Radio,
  FileCode2,
  Smartphone,
  Instagram,
  ShoppingBag
} from 'lucide-react';

interface MetaStatus {
  isLive: boolean;
  statusMode: string;
  webhookUrl: string;
  webhookVerifyToken: string;
  metaAppId: string;
  hasAppSecret: boolean;
  catalogId: string;
  phoneNumberId: string;
  wabaId: string;
  igUserId: string;
  tokenMasked: string;
}

export const BlueprintDocs: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [activeStep, setActiveStep] = useState<number>(1);

  useEffect(() => {
    fetch('/api/meta/status')
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch((err) => console.error('Erro ao buscar status da Meta:', err));
  }, []);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentWebhookUrl = status?.webhookUrl || (typeof window !== 'undefined' ? `${window.location.origin}/webhooks/meta` : 'http://localhost:3000/webhooks/meta');
  const verifyToken = status?.webhookVerifyToken || 'meta_webhook_secret_verify_token_123';

  const envTemplate = `# ========================================================
# VARIÁVEIS DE AMBIENTE - META OMNICHANNEL HUB
# Configure no seu servidor (ex: VPS, Railway, Render, Docker ou Cloud Run)
# ========================================================

PORT=3000
NODE_ENV=production

# 1. Banco de Dados e Fila Redis
DATABASE_URL="postgresql://postgres:sua_senha@localhost:5432/meta_hub?schema=public"
REDIS_URL="redis://localhost:6379"

# 2. Credenciais do Aplicativo na Meta (developers.facebook.com)
META_APP_ID="${status?.metaAppId || '123456789012345'}"
META_APP_SECRET="seu_app_secret_aqui"
META_WEBHOOK_VERIFY_TOKEN="${verifyToken}"

# 3. Token Permanente (System User Token - Business Manager)
# Gerado em business.facebook.com > Configurações do Negócio > Usuários do Sistema
META_SYSTEM_USER_TOKEN="EAA..."

# 4. WhatsApp Cloud API (WhatsApp > Início da API)
WHATSAPP_PHONE_NUMBER_ID="${status?.phoneNumberId || '109876543210987'}"
WHATSAPP_BUSINESS_ACCOUNT_ID="${status?.wabaId || '567890123456789'}"

# 5. Catálogo do Meta Commerce Manager (business.facebook.com/commerce)
META_CATALOG_ID="${status?.catalogId || '123456789012345'}"

# 6. Instagram Graph API (ID da conta comercial vinculada à Página)
INSTAGRAM_BUSINESS_ACCOUNT_ID="${status?.igUserId || '17841400000000000'}"
FACEBOOK_PAGE_ID="100000000000000"
PUBLIC_CDN_BASE_URL="${typeof window !== 'undefined' ? window.location.origin : 'https://cdn.seusite.com.br'}"`;

  const curlExamples = [
    {
      title: '1. Testar Webhook WhatsApp (Cloud API)',
      command: `curl -X POST "${currentWebhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5511999999999",
            "id": "wamid.HBgLNTUxMTAwMTIzNDU2",
            "timestamp": "1727000000",
            "type": "text",
            "text": { "body": "Quero ver tênis" }
          }]
        }
      }]
    }]
  }'`,
    },
    {
      title: '2. Enviar Lote para Meta Catalog Batch API',
      command: `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/catalog/sync-all"`,
    },
    {
      title: '3. Agendar Reels no Instagram',
      command: `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/instagram/schedule" \\
  -H "Content-Type: application/json" \\
  -d '{
    "mediaType": "REELS",
    "caption": "Novo drop esportivo! #reels #esporte",
    "mediaUrl": "https://assets.mixkit.co/videos/preview/mixkit-athlete-putting-on-his-running-shoes-42359-large.mp4"
  }'`,
    },
  ];

  const steps = [
    {
      number: 1,
      title: 'Criar App no Meta for Developers',
      icon: ExternalLink,
      desc: 'Acesse o portal e crie a aplicação empresarial',
      details: [
        'Acesse developers.facebook.com e faça login com sua conta do Facebook.',
        'No canto superior direito, clique em "Meus Aplicativos" (My Apps) e depois em "Criar Aplicativo" (Create App).',
        'Selecione o tipo de aplicativo: escolha "Outro" (Other) e depois "Empresa" (Business).',
        'Defina um nome para o aplicativo (ex: MeuHubOmnichannel) e selecione a sua Conta Empresarial (Meta Business Manager).',
        'Ao criar, você terá acesso ao App ID e App Secret nas Configurações Básicas.'
      ]
    },
    {
      number: 2,
      title: 'Habilitar o WhatsApp Cloud API',
      icon: Smartphone,
      desc: 'Obtenha o Phone Number ID e o WABA ID',
      details: [
        'No painel do aplicativo, vá em "Adicionar produtos" e clique em "Configurar" no card do WhatsApp.',
        'O Meta for Developers abrirá a tela "Início da API" (API Setup) fornecendo um número de teste oficial e 24h de envio grátis.',
        'Copie o "Identificação do número de telefone" (Phone Number ID) -> coloque em WHATSAPP_PHONE_NUMBER_ID.',
        'Copie o "Identificação da conta do WhatsApp Business" (WABA ID) -> coloque em WHATSAPP_BUSINESS_ACCOUNT_ID.',
        'Para usar o número oficial da sua empresa, basta clicar em "Adicionar número de telefone" e seguir o passo a passo com SMS/ligação.'
      ]
    },
    {
      number: 3,
      title: 'Configurar o Webhook no Painel da Meta',
      icon: Radio,
      desc: 'Conecte as mensagens recebidas a este servidor',
      details: [
        'No menu lateral do App da Meta, acesse WhatsApp > Configuração (Configuration).',
        'No bloco "Webhook", clique em "Editar".',
        'No campo "URL de Retorno" (Callback URL), cole exatamente a URL abaixo.',
        'No campo "Token de Verificação" (Verify Token), cole o token configurado no seu .env.',
        'Clique em "Verificar e Salvar". O nosso servidor responderá com o desafio (challenge) da Meta em menos de 50ms!',
        'Após salvar, clique em "Gerenciar campos" e marque a caixa "messages" (mensagens) para assinar os eventos em tempo real.'
      ]
    },
    {
      number: 4,
      title: 'Conectar o Catálogo (Commerce Manager)',
      icon: ShoppingBag,
      desc: 'Vincule a fonte única de produtos',
      details: [
        'Acesse o Gerenciador de Comércio da Meta em business.facebook.com/commerce.',
        'Crie ou selecione o catálogo de produtos da sua loja.',
        'Vá em Configurações do Catálogo > Detalhes do Catálogo e copie o "ID do Catálogo" (Catalog ID) -> coloque em META_CATALOG_ID.',
        'Vá em "Contas do WhatsApp vinculadas" e associe a sua conta de WhatsApp Business a este catálogo para habilitar mensagens interativas de produto.'
      ]
    },
    {
      number: 5,
      title: 'Conectar o Instagram Graph API',
      icon: Instagram,
      desc: 'Habilite a postagem de Reels e Feed',
      details: [
        'No Meta for Developers, adicione o produto "Instagram Graph API" ao seu aplicativo.',
        'Certifique-se de que a conta do Instagram é uma Conta Comercial ou Criador de Conteúdo vinculada a uma Página do Facebook.',
        'Obtenha o ID da conta do Instagram (pode ser consultado no Graph API Explorer via GET /me/accounts ou nas configurações do Business Manager) -> coloque em INSTAGRAM_BUSINESS_ACCOUNT_ID.'
      ]
    },
    {
      number: 6,
      title: 'Gerar o Token Permanente (System User)',
      icon: KeyRound,
      desc: 'Evite expiração de token a cada 60 dias',
      details: [
        'Tokens gerados no painel de desenvolvedor expiram em 24h ou 60 dias. Para servidores em produção, você DEVE gerar um Token de Usuário do Sistema (System User Token).',
        'Acesse business.facebook.com/settings/system-users.',
        'Clique em "Adicionar", defina um nome (ex: BotServidor) e escolha a função "Administrador".',
        'Clique em "Gerar novo token", selecione o seu aplicativo e marque as seguintes permissões:',
        '• whatsapp_business_messaging (enviar e ler mensagens)',
        '• whatsapp_business_management (gerenciar conta)',
        '• catalog_management (enviar lotes de produtos via Batch API)',
        '• instagram_basic e instagram_content_publish (postar Reels e fotos)',
        '• pages_read_engagement e pages_show_list (gerenciar páginas)',
        'Copie o token gerado (começa com EAA...) e cole em META_SYSTEM_USER_TOKEN.'
      ]
    }
  ];

  return (
    <div className="space-y-6" id="blueprint-docs-container">
      {/* Real-Time Meta Connection Status Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
              status?.isLive ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-blue-600 shadow-blue-500/20'
            }`}>
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">Status de Conexão com a Meta</h3>
                {status?.isLive ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Modo Produção Real (Token Ativo)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Modo Simulação & Testes Locais</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {status?.isLive
                  ? 'As requisições estão sendo enviadas diretamente para a Meta Graph API v21.0 com seu System User Token.'
                  : 'O servidor está simulando respostas da Meta com sucesso. Para conectar com suas contas reais, preencha as variáveis abaixo no servidor.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir Meta for Developers</span>
            </a>
          </div>
        </div>

        {/* Quick Webhook Setup Values (Copyable) */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-700">URL de Retorno (Callback URL) para o Webhook:</span>
              <button
                onClick={() => copyText(currentWebhookUrl, 'webhook-url')}
                className="inline-flex items-center space-x-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
              >
                {copiedKey === 'webhook-url' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-emerald-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>
            </div>
            <code className="p-2 bg-white rounded border border-slate-300 font-mono text-[11px] text-slate-800 break-all select-all">
              {currentWebhookUrl}
            </code>
            <p className="text-[10px] text-slate-400 mt-1">Cole este link no campo "URL de Retorno" no painel da Meta.</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-700">Token de Verificação (Verify Token):</span>
              <button
                onClick={() => copyText(verifyToken, 'verify-token')}
                className="inline-flex items-center space-x-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
              >
                {copiedKey === 'verify-token' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-emerald-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copiar Token</span>
                  </>
                )}
              </button>
            </div>
            <code className="p-2 bg-white rounded border border-slate-300 font-mono text-[11px] text-slate-800 break-all select-all">
              {verifyToken}
            </code>
            <p className="text-[10px] text-slate-400 mt-1">Cole este valor no campo "Token de Verificação" no painel da Meta.</p>
          </div>
        </div>
      </div>

      {/* Step by Step Interactive Setup Guide */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="mb-5">
          <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
            <FileCode2 className="h-5 w-5 text-blue-600" />
            <span>Guia Passo a Passo: Como Criar a API na Meta (Do Zero ao Produção)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Siga as 6 etapas abaixo para obter suas chaves oficiais da Meta e ligar o servidor em produção:
          </p>
        </div>

        {/* Step Tabs / Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {steps.map((st) => {
            const isSelected = activeStep === st.number;
            const Icon = st.icon;

            return (
              <button
                key={st.number}
                onClick={() => setActiveStep(st.number)}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {st.number}
                  </span>
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <div className="font-semibold text-xs text-slate-900 line-clamp-1">{st.title}</div>
              </button>
            );
          })}
        </div>

        {/* Active Step Details */}
        {steps.map((st) => {
          if (st.number !== activeStep) return null;
          const Icon = st.icon;

          return (
            <div key={st.number} className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Etapa {st.number}: {st.title}</h4>
                  <p className="text-slate-500 text-[11px]">{st.desc}</p>
                </div>
              </div>

              <div className="space-y-2 bg-white p-4 rounded-lg border border-slate-200/80 leading-relaxed text-slate-700">
                {st.details.map((paragraph, i) => (
                  <p key={i} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0"></span>
                    <span>{paragraph}</span>
                  </p>
                ))}
              </div>

              {/* Specific CTA for Step */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {activeStep < 6 ? `Próximo: Etapa ${activeStep + 1} (${steps[activeStep].title})` : 'Tudo pronto para subir ao servidor!'}
                </span>
                <div className="space-x-2">
                  {activeStep > 1 && (
                    <button
                      onClick={() => setActiveStep(activeStep - 1)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition"
                    >
                      Anterior
                    </button>
                  )}
                  {activeStep < 6 && (
                    <button
                      onClick={() => setActiveStep(activeStep + 1)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                    >
                      Próxima Etapa
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production .env Generator */}
      <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center space-x-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-white text-sm">Arquivo .env para colocar no seu Servidor</span>
          </div>
          <button
            onClick={() => copyText(envTemplate, 'env-template')}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs"
          >
            {copiedKey === 'env-template' ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copiado com Sucesso!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar .env Completo</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Ao subir este projeto em sua VPS, Docker, Railway ou Cloud Run, basta colar este arquivo como <code className="text-emerald-400 font-mono">.env</code> e preencher os valores das suas contas da Meta.
        </p>
        <pre className="p-3 bg-black/60 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-64 whitespace-pre">
          {envTemplate}
        </pre>
      </div>

      {/* Curl Command Snippets */}
      <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs">
        <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center space-x-2">
          <Terminal className="h-5 w-5 text-blue-600" />
          <span>Comandos de Teste no Terminal (cURL)</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Você pode testar seu servidor diretamente pelo terminal disparando requisições com os payloads oficiais da Meta:
        </p>

        <div className="space-y-4">
          {curlExamples.map((item, idx) => (
            <div key={idx} className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                <span className="text-xs font-semibold text-slate-300">{item.title}</span>
                <button
                  onClick={() => copyText(item.command, `curl-${idx}`)}
                  className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 transition"
                >
                  {copiedKey === `curl-${idx}` ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre">
                {item.command}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
