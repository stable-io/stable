# Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy workspace root files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/

# Copy workspace packages and apps
COPY packages/ ./packages/
COPY apps/back-end/ ./apps/back-end/

# Install all workspace dependencies from root
RUN yarn install --immutable

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy workspace root files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/

# Copy workspace packages and apps
COPY packages/ ./packages/
COPY apps/back-end/ ./apps/back-end/

# Install all workspace dependencies from root
RUN yarn install --immutable && yarn cache clean

# Set working directory to back-end app
WORKDIR /app/apps/back-end

# Copy source code from builder stage (no dist folder needed)
COPY --from=builder /app/apps/back-end/src ./src
COPY --from=builder /app/apps/back-end/tsconfig.json ./tsconfig.json
COPY --from=builder /app/apps/back-end/nest-cli.json ./nest-cli.json

# Copy any other necessary files (like static assets if any)
COPY --from=builder /app/apps/back-end/package.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

ARG PORT="3000"
ENV PORT=${PORT}
EXPOSE 3000

# Start the production server
CMD ["yarn", "start:prod"]
