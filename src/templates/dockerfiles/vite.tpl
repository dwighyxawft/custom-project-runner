# --- Vite React Project Dockerfile ---

FROM node:18-alpine

WORKDIR {{WORKDIR}}

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE {{PORT}}

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "{{PORT}}"]
