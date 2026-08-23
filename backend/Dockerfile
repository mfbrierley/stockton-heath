FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Install, build and prune in a single layer. A later RUN cannot reclaim space
# from an earlier one, so splitting these would ship the whole dev dependency
# tree inside the image no matter what the prune removed.
RUN npm ci \
  && npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

EXPOSE 3001

CMD ["node", "dist/index.js"]
