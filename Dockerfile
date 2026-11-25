FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends tini python3 python3-venv poppler-utils && rm -rf /var/lib/apt/lists/*
COPY scripts/requirements-finance.txt /tmp/requirements-finance.txt
RUN python3 -m venv /opt/sisfia-venv && /opt/sisfia-venv/bin/pip install --no-cache-dir -r /tmp/requirements-finance.txt
ENV FINANCE_PYTHON=/opt/sisfia-venv/bin/python
RUN groupadd --system app && useradd --system --gid app app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /app/data && chown -R app:app /app
VOLUME ["/app/data"]
USER app
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/index.js"]