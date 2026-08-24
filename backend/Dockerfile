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
#
# The droplet has 512MB of RAM, so Node sizes its own heap at roughly 256MB -
# just under what tsc needs here, and the build died with "JavaScript heap out
# of memory". Raised for the build only; it does not persist into the running
# image, and the droplet has 1GB of swap behind it if it spills.
RUN export NODE_OPTIONS="--max-old-space-size=512" \
  && npm ci \
  && npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

EXPOSE 3001

CMD ["node", "dist/index.js"]
