FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app (including pre-built frontend)
COPY . .

ENV FLASK_ENV=production
ENV FLASK_APP=app.py
ENV PORT=8000

EXPOSE 8000

CMD ["python", "app.py"]
