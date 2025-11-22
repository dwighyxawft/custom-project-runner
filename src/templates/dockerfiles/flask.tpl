# templates/flask.tpl
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV FLASK_APP=app.py
ARG PORT=8000
EXPOSE ${PORT}
CMD ["sh","-c","gunicorn -w 1 -b 0.0.0.0:${PORT} app:app"]
