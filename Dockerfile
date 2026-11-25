FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini python3 py3-pip poppler-utils
COPY scripts/requirements-finance.txt /tmp/requirements-finance.txt
RUN python3 -m venv /opt/sisfia-venv && /opt/sisfia-venv/bin/pip install --no-cache-dir -r /tmp/requirements-finance.txt
ENV FINANCE_PYTHON=/opt/sisfia-venv/bin/python
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