import { FastifyInstance } from 'fastify';

export async function legalRoutes(fastify: FastifyInstance) {
  // Política de Privacidade direta
  fastify.get('/privacy', async (request, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidade & Termos de Uso - 3facil.com</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f8fafc; }
    .card { background: #fff; padding: 36px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    h1 { color: #0f172a; margin-top: 0; font-size: 26px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    h2 { color: #1e293b; margin-top: 24px; font-size: 18px; }
    p, li { color: #475569; font-size: 15px; }
    .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .contact-box { background: #f1f5f9; padding: 16px; border-radius: 8px; margin-top: 24px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Conformidade LGPD & Meta Platform Policy</span>
    <h1>Política de Privacidade e Termos de Uso</h1>
    <p><strong>Aplicação:</strong> 3Facil Feed / Meta Omnichannel Hub (3facil.com)<br><strong>Última atualização:</strong> 2026</p>

    <h2>1. Objeto e Natureza da Plataforma</h2>
    <p>O <strong>3facil.com</strong> é uma plataforma SaaS (Software as a Service) que fornece infraestrutura tecnológica para que lojistas e revendedores gerenciem catálogos e publiquem seus produtos de forma integrada no Instagram e WhatsApp via Meta Graph API.</p>

    <h2>2. Coleta e Finalidade dos Dados</h2>
    <p>Nossa aplicação coleta exclusivamente os dados estritamente necessários para viabilizar as publicações e o catálogo comercial:</p>
    <ul>
      <li>Identificadores de página e contas do Instagram conectadas pelo lojista para agendamento de posts.</li>
      <li>Imagens, vídeos e legendas de produtos fornecidos pelo usuário para publicação.</li>
      <li>Mensagens e interações de suporte quando integradas via WhatsApp Business.</li>
    </ul>

    <h2>3. Não Compartilhamento com Terceiros</h2>
    <p>O <strong>3facil.com</strong> não vende, não aluga e não cede informações ou credenciais para terceiros para fins de marketing ou publicidade em massa.</p>

    <h2>4. Segurança e Armazenamento</h2>
    <p>Todas as comunicações com a Meta Graph API utilizam criptografia SSL/TLS de ponta a ponta e tokens de acesso são armazenados com segurança estrita.</p>

    <h2>5. Contato e Encarregado de Dados</h2>
    <div class="contact-box">
      Dúvidas, solicitações de privacidade ou informações:<br>
      E-mail: <a href="mailto:site3facil@gmail.com">site3facil@gmail.com</a>
    </div>
  </div>
</body>
</html>`);
  });

  // Instruções de Exclusão de Dados do Usuário (Exigência estrita da Meta)
  fastify.get('/data-deletion', async (request, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instruções de Exclusão de Dados - 3facil.com</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f8fafc; }
    .card { background: #fff; padding: 36px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    h1 { color: #0f172a; margin-top: 0; font-size: 26px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    h2 { color: #1e293b; margin-top: 24px; font-size: 18px; }
    p, li { color: #475569; font-size: 15px; }
    ol { padding-left: 20px; color: #475569; }
    li { margin-bottom: 8px; }
    .contact-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin-top: 24px; color: #1e40af; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Instruções de Exclusão de Dados do Usuário</h1>
    <p>O aplicativo <strong>3Facil Feed</strong> respeita integralmente as diretrizes da Meta Platform e a Lei Geral de Proteção de Dados (LGPD).</p>

    <h2>Como solicitar a exclusão dos seus dados:</h2>
    <ol>
      <li>Acesse as <strong>Configurações e Privacidade</strong> da sua conta do Facebook ou Instagram.</li>
      <li>Vá em <strong>Aplicativos e Sites</strong> e localize o aplicativo <strong>3Facil Feed</strong>.</li>
      <li>Clique em <strong>Remover</strong> para revogar todas as permissões concedidas.</li>
      <li>Se você também deseja que todos os registros, históricos de publicações ou catálogos sincronizados sejam permanentemente excluídos do nosso banco de dados, envie uma solicitação com o assunto <em>"Exclusão de Dados de Usuário"</em> para:
        <div class="contact-box">
          <strong>E-mail de Suporte:</strong> <a href="mailto:site3facil@gmail.com">site3facil@gmail.com</a>
        </div>
      </li>
      <li>Nossa equipe processará e confirmará a remoção completa de todos os seus dados em até 48 horas úteis.</li>
    </ol>
  </div>
</body>
</html>`);
  });

  // Callback de exclusão de dados via POST (para webhook automatizado da Meta)
  fastify.post('/api/meta/data-deletion', async (request, reply) => {
    const confirmationCode = 'del_' + Date.now();
    return {
      url: `https://meta.3facil.com/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode
    };
  });
}
