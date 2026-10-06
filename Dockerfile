# Base: official Node 24 on slim Debian. No compilers, no dev tooling.
FROM node:24-slim

# Every later path is relative to this folder inside the image.
WORKDIR /app

# Manifests first so the dependency layer is cached until they change.
# A code edit then rebuilds only the layers below this one.
COPY package*.json ./
RUN npm ci --omit=dev

# Application source. No .env, no node_modules (see .dockerignore).
COPY src ./src

# Never run as root inside the container; the node image ships this user.
USER node

# Documentation only. The host injects PORT and the app reads it from env.
EXPOSE 3000

# What runs when a container starts: migrate (idempotent), then serve.
CMD ["npm", "start"]
