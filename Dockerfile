# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS client-deps
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci

FROM client-deps AS client-build
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
COPY client/ ./
RUN npm run build

FROM node:22-bookworm-slim AS server-deps
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=5001
ENV SERVE_CLIENT=true
WORKDIR /app/server

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 appuser \
  && mkdir -p /app/server/uploads /app/server/public \
  && chown -R appuser:nodejs /app/server

COPY --from=server-deps --chown=appuser:nodejs /app/server/node_modules ./node_modules
COPY --chown=appuser:nodejs server/ ./
COPY --from=client-build --chown=appuser:nodejs /app/client/dist ./public

USER appuser
EXPOSE 5001

CMD ["node", "server.js"]

FROM runner AS worker
CMD ["node", "worker.js"]
