# templates/django.tpl
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONUNBUFFERED=1
ARG PORT=8000
EXPOSE ${PORT}
CMD ["sh","-c","python manage.py migrate --no-input || true; python manage.py runserver 0.0.0.0:${PORT}"]
