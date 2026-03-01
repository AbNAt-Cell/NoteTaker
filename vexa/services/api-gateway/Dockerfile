# Base Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install shared library first
COPY ./libs/shared-models /app/libs/shared-models
RUN --mount=type=cache,target=/root/.cache/pip pip install --default-timeout=45 --retries 50 /app/libs/shared-models

# Copy application code and requirements
COPY ./services/api-gateway/requirements.txt /app/
COPY ./services/api-gateway/main.py /app/

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/pip pip install --default-timeout=45 --retries 50 -r requirements.txt

# Expose port (e.g., 8000 for the gateway)
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 