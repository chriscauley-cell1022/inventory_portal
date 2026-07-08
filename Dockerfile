FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build

FROM python:3.11-slim

WORKDIR /app

# Copy Python requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app code
COPY . .

# Copy the built frontend from the builder stage
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

ENV FLASK_ENV=production
ENV FLASK_APP=app.py
ENV PORT=8000

EXPOSE 8000

CMD ["python", "app.py"]
