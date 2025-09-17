
# Stage 1: Build the Rust application
FROM rust:1.85 AS builder

WORKDIR /usr/src/app
COPY . .

# Build with release optimizations
RUN cargo build --release

# Stage 2: Build the Go application
FROM golang:1.24.4 AS go-builder

WORKDIR /go/src/app

RUN git clone https://github.com/celestiaorg/op-alt-da

WORKDIR /go/src/app/op-alt-da

RUN git checkout tux/compat

RUN make

# Stage 3: Create the final image with Redis and the application
FROM redis:latest

WORKDIR /app

# Install necessary dependencies for the Rust application (from original Dockerfile)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl-dev \
    wget \
    git \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /usr/src/app/target/release/localestia /app/localestia

# Copy the Go binary from the go-builder stage
COPY --from=go-builder /go/src/app/op-alt-da/bin/da-server /app/da-server

# Set environment variables
ENV REDIS_URL=redis://127.0.0.1:6379
ENV LISTEN_ADDR=0.0.0.0:26658
ENV CLEAR_REDIS=true

# Expose the port for the application
EXPOSE 26658

# Start Redis and then the application
CMD ["sh", "-c", "redis-server & \
    until redis-cli ping; do echo \"Waiting for Redis...\"; sleep 1; done; \
    ./localestia & \
    until nc -z localhost 26658; do echo \"Waiting for localestia...\"; sleep 1; done; \
    ./da-server  -addr 0.0.0.0 -port 3100 --celestia.addr http://localhost:26658 --celestia.auth-token 123 --celestia.namespace 000000000000000000000000000000000000000000008e5f679bf7116c --s3.endpoint s3.test.amazonaws.com"]
