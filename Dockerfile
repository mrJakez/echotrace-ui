FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

FROM base AS mcp-runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
COPY mcp_service/requirements.txt ./mcp_service/requirements.txt
RUN python3 -m venv /opt/echotrace-mcp \
    && /opt/echotrace-mcp/bin/pip install --no-cache-dir -r mcp_service/requirements.txt
COPY mcp_service ./mcp_service
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM mcp-runtime AS dev
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000 8090
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM base AS builder
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BUILD_SHA=$BUILD_SHA
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM mcp-runtime AS runner
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BUILD_SHA=$BUILD_SHA
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000 8090
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
