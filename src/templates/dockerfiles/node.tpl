FROM node:18-slim
WORKDIR /app

# If package.json exists, install; otherwise skip silently
COPY package*.json ./ || true
RUN [ -f package.json ] && npm install --production || echo "No package.json found, skipping npm install"

COPY . .

ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["sh", "-c", "npm run start --if-present || node index.js || node server.js"]
