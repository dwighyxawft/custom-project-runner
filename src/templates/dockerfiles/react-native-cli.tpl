# templates/react-native-cli.tpl
FROM openjdk:11-jdk
RUN apt-get update && apt-get install -y curl unzip
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Install Android SDK tools? Not included. Document that building APKs requires SDK and larger images.
CMD ["sh","-c","./gradlew assembleDebug"]
