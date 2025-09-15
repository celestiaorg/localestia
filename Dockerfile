
# Stage 1: Build the Rust application
FROM rust:1.85 AS builder

WORKDIR /usr/src/app
COPY . .

# Build with release optimizations
RUN cargo build --release

# Stage 2: Create the final image with Redis and the application
FROM redis:latest

WORKDIR /app

# Install necessary dependencies for the Rust application (from original Dockerfile)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /usr/src/app/target/release/localestia /app/localestia

# Set environment variables
ENV REDIS_URL=redis://127.0.0.1:6379
ENV LISTEN_ADDR=0.0.0.0:26658
ENV CLEAR_REDIS=true

# Expose the port for the application
EXPOSE 26658

# Start Redis and then the application
CMD ["sh", "-c", "redis-server & \
    until redis-cli ping; do echo \"Waiting for Redis...\"; sleep 1; done; \
    ./localestia"]
