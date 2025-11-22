# templates/react-native-metro.tpl
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PORT=8081
EXPOSE ${PORT}
CMD ["sh","-c","npx react-native start --port ${PORT} --host 0.0.0.0"]
