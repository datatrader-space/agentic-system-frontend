# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

# Production stage — Nginx serves SPA only
FROM nginx:alpine

# Copy built SPA
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx config (SPA-only, no proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
