FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY src/ ./src/
COPY prisma/ ./prisma/

RUN npm run build

RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/index.js"]
