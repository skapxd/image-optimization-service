# Multi-stage build for Node.js application
# Stage 1: Build stage
FROM node:20-alpine AS builder

# Install build dependencies including Python and build tools for native modules (sharp)
# Also install curl for health checks
RUN apk add --no-cache python3 make g++ vips-dev curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN yarn

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Install runtime dependencies for sharp, image processing, and health checks
RUN apk add --no-cache vips curl

# Create non-root user for security
RUN addgroup -g 10001 -S nodejs
RUN adduser -S nestjs -u 10001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (joi is needed for runtime validation)
# RUN npm ci && npm cache clean --force
RUN yarn install

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory for file handling
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the application with optimized Node.js settings for Piscina
CMD ["node", "dist/src/main.js"]