FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY openapi ./openapi
COPY scripts/validate-production-env.sh ./scripts/validate-production-env.sh
COPY entrypoint.sh ./entrypoint.sh
RUN addgroup -S hope && adduser -S -G hope hope \
    && mkdir -p /app/data /app/storage /app/tmp \
    && chown -R hope:hope /app
USER hope
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e 'fetch("http://127.0.0.1:3000/live").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
CMD ["node", "src/server.js"]
