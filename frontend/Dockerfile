# ─────────────────────────────────────────────────────────────────────────────
# NetRakshak Frontend Dockerfile
# Multi-stage build with Nginx static delivery
# ─────────────────────────────────────────────────────────────────────────────

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production delivery stage
FROM nginx:alpine

# Copy built static SPA assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config to support client-side SPA routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://backend:8000/api/; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

