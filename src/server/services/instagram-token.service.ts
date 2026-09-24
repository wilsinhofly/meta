import fs from 'fs';
import path from 'path';
import { db } from '../db/prisma.js';

export interface TokenExchangeResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number; // segundos (ex: 5184000 = 60 dias)
  expiresAt: string; // ISO date string
  accountInfo?: {
    id: string;
    username?: string;
  };
}

/**
 * Tenta salvar ou atualizar a variável INSTAGRAM_LOGIN_ACCESS_TOKEN no arquivo .env
 */
export function updateEnvFile(key: string, value: string): { updated: boolean; envPath: string } {
  // Caminhos comuns para o arquivo .env (dentro do container ou na raiz do projeto)
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    '/app/.env',
    '/home/ec2-user/meta-omnichannel-hub/.env'
  ];

  let targetPath = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      targetPath = p;
      break;
    }
  }

  if (!targetPath) {
    // Se não existir nenhum, cria no cwd
    targetPath = path.resolve(process.cwd(), '.env');
  }

  try {
    let content = '';
    if (fs.existsSync(targetPath)) {
      content = fs.readFileSync(targetPath, 'utf8');
    }

    const regex = new RegExp(`^${key}=.*$`, 'm');
    let newContent = '';

    if (regex.test(content)) {
      newContent = content.replace(regex, `${key}="${value}"`);
    } else {
      newContent = content.trim() ? `${content.trim()}\n${key}="${value}"\n` : `${key}="${value}"\n`;
    }

    fs.writeFileSync(targetPath, newContent, 'utf8');
    console.log(`[Instagram Token Service] Chave ${key} atualizada com sucesso no arquivo ${targetPath}`);
    return { updated: true, envPath: targetPath };
  } catch (err: any) {
    console.warn(`[Instagram Token Service] Aviso: Não foi possível gravar diretamente no .env (${targetPath}): ${err.message}`);
    return { updated: false, envPath: targetPath };
  }
}

/**
 * Troca um token de curta duração por um token de longa duração (válido por 60 dias)
 * Endpoint oficial da Meta / Instagram Graph API:
 * GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret={app_secret}&access_token={short_lived_token}
 */
export async function exchangeInstagramToken(params: {
  shortLivedToken: string;
  clientSecret: string;
  persistToEnv?: boolean;
}): Promise<TokenExchangeResult> {
  const { shortLivedToken, clientSecret, persistToEnv = true } = params;

  if (!shortLivedToken || !shortLivedToken.trim()) {
    throw new Error('Token de curta duração (shortLivedToken) é obrigatório.');
  }

  if (!clientSecret || !clientSecret.trim()) {
    throw new Error('Chave secreta do aplicativo do Instagram (clientSecret / INSTAGRAM_APP_SECRET) é obrigatória.');
  }

  console.log(`[Instagram Token Service] Solicitando troca de token de curta duração via ig_exchange_token...`);

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', clientSecret.trim());
  url.searchParams.set('access_token', shortLivedToken.trim());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const errorMsg = data.error?.message || data.error_description || JSON.stringify(data);
    const code = data.error?.code || response.status;
    console.error(`[Instagram Token Service] Erro da Meta ao trocar token (HTTP ${response.status}, code ${code}): ${errorMsg}`);
    throw new Error(`Falha na troca de token na Meta Graph API (HTTP ${response.status}): ${errorMsg}`);
  }

  const longLivedToken: string = data.access_token;
  const tokenType: string = data.token_type || 'bearer';
  // expires_in em segundos (ex: 5184000 = 60 dias)
  const expiresIn: number = data.expires_in || 5184000;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  console.log(`[Instagram Token Service] Sucesso! Novo token de longa duração gerado. Validade: ${Math.round(expiresIn / 86400)} dias (${expiresAt.toISOString()})`);

  // 1. Testa o novo token chamando GET https://graph.instagram.com/me
  let accountInfo: { id: string; username?: string } | undefined;
  try {
    const meRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${longLivedToken}`);
    if (meRes.ok) {
      const meData = await meRes.json();
      accountInfo = {
        id: meData.id,
        username: meData.username,
      };
      console.log(`[Instagram Token Service] Conta confirmada: @${meData.username} (ID: ${meData.id})`);
    }
  } catch (err: any) {
    console.warn(`[Instagram Token Service] Não foi possível obter info imediata do usuário: ${err.message}`);
  }

  // 2. Persistência no Banco de Dados
  try {
    await db.saveCredential({
      channel: 'INSTAGRAM',
      tokenType: 'USER_ACCESS',
      token: longLivedToken,
      expiresAt,
      isValid: true,
      lastCheckedAt: new Date(),
    });
  } catch (dbErr: any) {
    console.warn(`[Instagram Token Service] Aviso ao persistir credencial no banco: ${dbErr.message}`);
  }

  // 3. Atualiza na memória do processo para efeito imediato em workers sem reiniciar
  process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN = longLivedToken;
  process.env.INSTAGRAM_ACCESS_TOKEN = longLivedToken;

  // 4. Persistência no arquivo .env
  if (persistToEnv) {
    updateEnvFile('INSTAGRAM_LOGIN_ACCESS_TOKEN', longLivedToken);
    updateEnvFile('INSTAGRAM_ACCESS_TOKEN', longLivedToken);
  }

  return {
    accessToken: longLivedToken,
    tokenType,
    expiresIn,
    expiresAt: expiresAt.toISOString(),
    accountInfo,
  };
}
