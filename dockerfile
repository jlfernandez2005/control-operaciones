FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /app/data && chown -R app:app /app
VOLUME ["/app/data"]
USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]