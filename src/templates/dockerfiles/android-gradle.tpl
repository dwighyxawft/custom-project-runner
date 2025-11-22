# templates/android-gradle.tpl
FROM gradle:7.6-jdk11
WORKDIR /app
COPY . .
RUN gradle assembleDebug --no-daemon
CMD ["sh","-c","echo 'APK built at app/build/outputs/...'; sleep infinity"]
