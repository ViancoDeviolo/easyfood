FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependências primeiro: aproveita o cache de camadas do Docker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Pasta das fotos (montada como volume no docker-compose); o usuário "node" precisa escrever nela
RUN mkdir -p /app/storage && chown node:node /app/storage

EXPOSE 3000
USER node
CMD ["node", "server.js"]
