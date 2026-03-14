FROM python:3.11-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy project files needed for package build
COPY pyproject.toml uv.lock README.md .

# Copy source code (needed for editable install)
COPY src/ ./src/

# Install dependencies using uv
RUN uv sync --frozen --no-dev

COPY main.py .
COPY data/ ./data/

EXPOSE 8000
EXPOSE 7860

ENV API_URL=http://localhost:8000
ENV GRADIO_SERVER_NAME=0.0.0.0

CMD ["uv", "run", "python", "main.py"]