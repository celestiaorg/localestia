FROM rust:1.85 AS builder

WORKDIR /usr/src/app
COPY . .

# Build with release optimizations
RUN cargo build --release

# Create a smaller runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /usr/src/app/target/release/localestia /app/localestia

# Set environment variables (these can be overridden at runtime)
ENV REDIS_URL=redis://redis:6379
ENV LISTEN_ADDR=0.0.0.0:26658
ENV CLEAR_REDIS=true

# Expose the port
EXPOSE 26658

# Run the binary
CMD ["./localestia"]