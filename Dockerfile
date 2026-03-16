FROM python:3.11-slim

WORKDIR /app

# Install system deps for asyncpg and Node.js for npx
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*


# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 8000

CMD ["python", "main.py", "serve"]
