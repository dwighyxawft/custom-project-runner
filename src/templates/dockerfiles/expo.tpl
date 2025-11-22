# templates/expo.tpl
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PORT=19000
EXPOSE ${PORT}
CMD ["sh","-c","npm start -- --tunnel"]
