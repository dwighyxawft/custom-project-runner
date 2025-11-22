# templates/jupyter.tpl
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install nbconvert
COPY . .
RUN for f in *.ipynb; do jupyter nbconvert --to script "$f" || true; done
CMD ["sh","-c","python main.py || python $(ls *.py | head -n1)"]
