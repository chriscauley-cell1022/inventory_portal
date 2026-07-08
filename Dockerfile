FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build

FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend-build /app/frontend/build ./frontend/build

ENV FLASK_ENV=production
ENV FLASK_APP=app.py
ENV PORT=8000

EXPOSE 8000
CMD ["python", "app.py"]
