# ── Stage 1: build the React app ─────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# VITE_API_BASE_URL must be set at BUILD time, not runtime — Vite inlines it
ARG VITE_API_BASE_URL=https://api.xposelink.site
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy nginx config from a real file (more reliable than RUN echo)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
