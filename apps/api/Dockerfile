FROM node:20-alpine

# Install tini for proper PID 1 signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code, scripts, and PM2 config
COPY src ./src
COPY scripts ./scripts
COPY ecosystem.config.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080

# Use tini as entrypoint (handles zombie processes & signals)
ENTRYPOINT ["/sbin/tini", "--"]

# Start with PM2 in cluster mode
CMD ["pm2-runtime", "ecosystem.config.js"]
