#!/bin/bash
set -e

echo "🚀 [1/3] Puxando as últimas atualizações do GitHub..."
cd /home/ec2-user/meta-omnichannel-hub
git fetch origin main
git reset --hard origin/main

echo "📁 [2/3] Garantindo pastas de uploads..."
mkdir -p public/uploads

echo "🐳 [3/3] Reconstruindo e reiniciando os containers Docker..."
docker compose down || docker-compose down || true
docker compose up -d --build || docker-compose up -d --build

echo "✅ Deploy concluído com sucesso em https://meta.3facil.com!"
