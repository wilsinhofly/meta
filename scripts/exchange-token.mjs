#!/usr/bin/env node
/**
 * Script utilitário CLI para trocar token de curta duração por Long-Lived Token (60 dias)
 * Uso:
 *   node scripts/exchange-token.mjs <SHORT_LIVED_TOKEN> [APP_SECRET]
 * ou se as variáveis já estiverem no .env:
 *   node scripts/exchange-token.mjs
 */

import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const args = process.argv.slice(2);
const shortLivedToken = args[0] || process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;
const clientSecret = args[1] || process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;

console.log('------------------------------------------------------------');
console.log('  Meta / Instagram Long-Lived Token Exchange Utility');
console.log('------------------------------------------------------------');

if (!shortLivedToken) {
  console.error('❌ Erro: Nenhum token de curta duração fornecido.');
  console.log('Uso: node scripts/exchange-token.mjs <SHORT_LIVED_TOKEN> [APP_SECRET]');
  process.exit(1);
}

if (!clientSecret) {
  console.error('❌ Erro: Chave secreta do aplicativo do Instagram (INSTAGRAM_APP_SECRET / META_APP_SECRET) não informada.');
  console.log('Informe via argumento ou adicione INSTAGRAM_APP_SECRET=... no .env');
  process.exit(1);
}

async function run() {
  console.log(`📡 Conectando a https://graph.instagram.com/access_token...`);
  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', clientSecret.trim());
  url.searchParams.set('access_token', shortLivedToken.trim());

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      console.error(`❌ Erro da Meta API (HTTP ${res.status}):`);
      console.error(data);
      process.exit(1);
    }

    const longLivedToken = data.access_token;
    const expiresInDays = Math.round((data.expires_in || 5184000) / 86400);

    console.log(`\n✅ SUCESSO! Novo token de longa duração gerado:`);
    console.log(`   Token: ${longLivedToken}`);
    console.log(`   Validade estimada: ~${expiresInDays} dias`);

    try {
      const meRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${longLivedToken}`);
      if (meRes.ok) {
        const me = await meRes.json();
        console.log(`   Conta autenticada: @${me.username || 'n/a'} (ID: ${me.id})`);
      }
    } catch (_) {}

    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      const regex = /^INSTAGRAM_LOGIN_ACCESS_TOKEN=.*$/m;
      if (regex.test(content)) {
        content = content.replace(regex, `INSTAGRAM_LOGIN_ACCESS_TOKEN="${longLivedToken}"`);
      } else {
        content += `\nINSTAGRAM_LOGIN_ACCESS_TOKEN="${longLivedToken}"\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
      console.log(`💾 Atualizado automaticamente em ${envPath}`);
    } else {
      console.log(`⚠️ Arquivo .env não encontrado. Copie e cole a chave no seu .env:`);
      console.log(`INSTAGRAM_LOGIN_ACCESS_TOKEN="${longLivedToken}"`);
    }

    console.log('\nReinicie o container para aplicar: docker compose restart meta-hub\n');
  } catch (err) {
    console.error('❌ Falha na conexão:', err.message);
    process.exit(1);
  }
}

run();
