# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# --- Install Shared Library ---
# Copy the shared library source code
COPY ./libs/shared-models/ /app/libs/shared-models/
# Install the shared library
# Use buildx cache mount to persist downloaded wheels across flaking network drops
RUN --mount=type=cache,target=/root/.cache/pip pip install --default-timeout=45 --retries 50 /app/libs/shared-models/

# --- Install App Dependencies ---
# Copy the requirements file
COPY ./services/bot-manager/requirements.txt .
# Install biggest dependencies first to minimize timeout rollback impact
RUN --mount=type=cache,target=/root/.cache/pip pip install --default-timeout=45 --retries 50 boto3 psycopg2-binary deepgram-sdk pydantic
# Install remaining dependencies
RUN --mount=type=cache,target=/root/.cache/pip pip install --default-timeout=45 --retries 50 -r requirements.txt

# --- Copy App Source ---
# Copy the entire application source code
COPY ./services/bot-manager/app/ ./app

# Expose the port the app runs on
EXPOSE 8080

# Run the application as a module
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"] 