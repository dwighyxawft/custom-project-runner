# templates/dl.tpl
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN apt-get update && apt-get install -y build-essential
# Use CPU-only wheel install directions in requirements.txt (torch==...+cpu)
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
