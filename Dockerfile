# Use a multi-platform base image
FROM --platform=$BUILDPLATFORM rust:1.87-alpine AS builder

# Set build arguments to support cross-compilation
ARG TARGETPLATFORM
ARG BUILDPLATFORM

WORKDIR /usr/src/app
COPY . .

# Install build dependencies for Rust on Alpine
RUN apk add --no-cache build-base openssl-dev pkgconf

# Install cross-compilation tools if needed
RUN if [ "$BUILDPLATFORM" != "$TARGETPLATFORM" ]; then \
    rustup target add aarch64-unknown-linux-musl x86_64-unknown-linux-musl; \
    fi

# Build with release optimizations (using the appropriate musl target)
RUN case "$TARGETPLATFORM" in \
    "linux/amd64") cargo build --release --target x86_64-unknown-linux-musl ;; \
    "linux/arm64") cargo build --release --target aarch64-unknown-linux-musl ;; \
    *) cargo build --release ;; \
    esac

# Create a smaller runtime image
FROM --platform=$TARGETPLATFORM alpine:3.19

# Install runtime dependencies (minimal)
RUN apk add --no-cache ca-certificates openssl libc6-compat

WORKDIR /app

# Copy the binary from the builder stage (with path adjusted for musl targets)
COPY --from=builder /usr/src/app/target/*/release/localestia /app/localestia

# Set environment variables
ENV REDIS_URL=redis://redis:6379
ENV LISTEN_ADDR=0.0.0.0:26658
ENV CLEAR_REDIS=true

# Expose the port
EXPOSE 26658

# Run the binary
CMD ["./localestia"]