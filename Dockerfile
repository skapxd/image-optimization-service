# Multi-stage build for Node.js application
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Install build dependencies including Python and build tools for native modules (sharp)
RUN apk add --no-cache python3 make g++ vips-dev

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
FROM node:18-alpine AS production

# Install only runtime dependencies for sharp and image processing
RUN apk add --no-cache vips

# Create non-root user for security
RUN addgroup -g 10001 -S nodejs
RUN adduser -S nestjs -u 10001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (joi is needed for runtime validation)
RUN npm ci && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory for file handling
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "dist/main.js"]