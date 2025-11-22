# templates/nestjs.tpl
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["node", "dist/main.js"]
