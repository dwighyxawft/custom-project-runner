# Stage 1: Build
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build the NestJS app
RUN npm run build

# Copy templates manually (Nest does NOT compile .tpl files)
RUN mkdir -p dist/templates && cp -r src/templates dist/

# ------------------------------

# Stage 2: Run
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Copy built dist from builder
COPY --from=builder /app/dist ./dist

# Required for Docker inside container
VOLUME /var/run/docker.sock

EXPOSE 3000
EXPOSE 3001

CMD ["node", "dist/main.js"]
