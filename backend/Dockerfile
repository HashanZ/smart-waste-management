# Use Node.js 20 Alpine image (latest LTS)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (include dev deps for build and tsconfig-paths at runtime)
RUN npm install

# Copy source code
COPY . .

# Build the application (this resolves TypeScript path aliases)
RUN npm run build

# Copy tsconfig.json for tsconfig-paths runtime resolution
RUN cp tsconfig.json dist/ 2>/dev/null || true

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]











