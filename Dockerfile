# ==============================================================================
# EduCore LMS — Production Multi-Stage Dockerfile
# ==============================================================================

# 1. Estágio de Build
FROM node:20-alpine AS builder

WORKDIR /app

# Ferramentas nativas necessárias para compilar better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY public ./public

RUN npm run build

# 2. Estágio de Produção (Imagem Leve e Otimizada)
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache python3 make g++

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

# Copia build JavaScript, frontend estático e migrations SQL
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY src/db/migrations ./src/db/migrations

# Cria diretórios de persistência do SQLite e uploads
RUN mkdir -p data uploads/videos uploads/materials uploads/certificates

EXPOSE 3000

CMD ["node", "dist/index.js"]
