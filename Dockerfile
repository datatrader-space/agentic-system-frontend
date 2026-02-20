# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage — Nginx with envsubst for BACKEND_URL
FROM nginx:alpine

# Copy built SPA
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx config template (uses $BACKEND_URL variable)
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# nginx:alpine supports /etc/nginx/templates/*.template
# It auto-runs envsubst on them at startup, outputting to /etc/nginx/conf.d/
# BACKEND_URL must be set as an environment variable
CMD ["nginx", "-g", "daemon off;"]
