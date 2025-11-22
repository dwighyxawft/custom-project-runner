# templates/next.tpl
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PORT=3000
ENV PORT=${PORT}
RUN npm run build
EXPOSE ${PORT}
CMD ["sh", "-c", "npm run start"]
