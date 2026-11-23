# ---------- MBCINDONESIA.TV — image produksi ----------
# Build context = root repo (butuh server/ DAN website/):
#   docker build -f server/Dockerfile -t mbcindonesia-tv .
# atau: cd server && docker compose up -d --build
FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# wget untuk healthcheck, tini sebagai init (reaping proses)
RUN apk add --no-cache wget tini && addgroup -S mbc && adduser -S mbc -G mbc

COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./
# Situs statis: server.js menyajikan path ../website relatif dari folder server.
# Karena kode berada di /app, situs harus ada di /website.
COPY website/ /website/

# Jangan pernah bawa secret/artefak lokal ke dalam image
RUN rm -rf .env .env.local npm-debug.log* backups .git && chown -R mbc:mbc /app /website

USER mbc
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
