FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache ffmpeg

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS dev
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
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

FROM base AS runner
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BUILD_SHA=$BUILD_SHA
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

FROM python:3.12-slim AS mcp
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY mcp_service/requirements.txt ./mcp_service/requirements.txt
RUN pip install --no-cache-dir -r mcp_service/requirements.txt
COPY mcp_service ./mcp_service
EXPOSE 8090
CMD ["uvicorn", "mcp_service.server:app", "--host", "0.0.0.0", "--port", "8090"]
