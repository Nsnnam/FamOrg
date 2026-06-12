# --- STAGE 1: BUILD ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools if native modules need compiling
RUN apk add --no-cache python3 make g++

# Copy dependency files
COPY package*.json ./

# Install dependencies (including devDependencies for compiling)
RUN npm ci

# Copy the rest of the application files
COPY tsconfig.json vite.config.ts index.html metadata.json ./
COPY src/ ./src/
COPY server.ts ./
COPY server/ ./server/

# Build client bundle and compile server script
RUN npm run build

# Remove development dependencies to keep output tiny
RUN npm prune --production

# --- STAGE 2: PRODUCTION ---
FROM node:20-alpine AS runner

WORKDIR /app

# Create a directory to store persistent data (database + backups)
RUN mkdir -p /app/data && chown -y node:node /app/data || true

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary production files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose port 3000 (standard ingress port for container routing)
EXPOSE 3000

# Run container as non-root user for security
USER node

# Start full-stack system
CMD ["npm", "start"]
