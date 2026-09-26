FROM node:20-alpine
WORKDIR /app

# Copia dependências primeiro para aproveitar o cache
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copia código e compila
COPY . .
RUN npm run build
RUN mkdir -p public/uploads /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.cjs"]
