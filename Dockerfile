FROM rust:latest AS chef
# cargo-chef is a small Rust binary; installing here avoids repeating in later stages
RUN cargo install cargo-chef
WORKDIR /usr/src/app

# Copy only manifests first to maximize dependency caching
COPY Cargo.toml Cargo.lock ./
# If using a workspace, also copy member Cargo.toml files:
# COPY crates/*/Cargo.toml ./crates/*/

# Prepare dependency graph
RUN cargo chef prepare --recipe-path recipe.json

############################
FROM rust:latest AS builder
ARG BIN=localestia
WORKDIR /usr/src/app

# Reuse cargo-chef from the planner to avoid reinstall
COPY --from=chef /usr/local/cargo/bin/cargo-chef /usr/local/cargo/bin/cargo-chef
COPY --from=chef /usr/src/app/recipe.json ./recipe.json

# Cook deps (this compiles all dependencies, but not your code)
# BuildKit caches registry, git, and target to speed up subsequent builds
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/usr/src/app/target \
    cargo chef cook --release --recipe-path recipe.json

# Now bring in the actual source
COPY . .

# Compile your binary (reuses the cached deps + target artifacts)
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/usr/src/app/target \
    cargo build --release --bin $BIN

############################
FROM debian:bookworm-slim AS runtime
ARG BIN=localestia

# Minimal runtime deps (OpenSSL 3 on Bookworm)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy only the compiled binary
COPY --from=builder /usr/src/app/target/release/${BIN} /app/${BIN}

# Defaults (override at runtime)
ENV REDIS_URL=redis://redis:6379 \
    LISTEN_ADDR=0.0.0.0:26658 \
    CLEAR_REDIS=true

EXPOSE 26658
ENTRYPOINT ["/app/localestia"]
