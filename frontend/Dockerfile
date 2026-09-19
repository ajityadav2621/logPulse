# LogPulse frontend — Vite/React SPA.
#
# This Dockerfile's final stage IS an nginx:alpine that serves the built
# `dist/` on port 80 by itself (same contract as the reference project's
# frontend image). deployment/nginx/nginx.conf is a SEPARATE, outer nginx
# that terminates TLS and reverse-proxies to this container plus the
# backend — it does not replace this one. This container does not know
# about TLS or /api — it only serves the SPA with client-side routing
# fallback (try_files ... /index.html).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Baked in at build time (Vite inlines VITE_* vars into the bundle — they
# cannot be changed at container-start like a normal runtime env var).
# Point this at wherever the backend is actually reachable from the
# browser: through deployment/nginx (default, same-origin) leave unset;
# for a split/public deployment, pass --build-arg VITE_API_URL=https://api.yourdomain.com
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=${VITE_API_URL}
ARG VITE_DOCS_URL=http://localhost:3001
ENV VITE_DOCS_URL=${VITE_DOCS_URL}
RUN npm run build

FROM nginx:1.27-alpine AS final
RUN apk add --no-cache wget
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O - http://localhost/ >/dev/null || exit 1
