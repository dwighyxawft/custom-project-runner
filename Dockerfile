# Use Node.js LTS
FROM node:20

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy everything
COPY . .

# Build the project
RUN npm run build

# Expose backend port
EXPOSE 3000
# Expose WebSocket port
EXPOSE 3001

# Start the server
CMD ["npm", "run", "start:dev"]
