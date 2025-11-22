# templates/node.tpl
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["sh", "-c", "npm run start --if-present || node index.js"]
