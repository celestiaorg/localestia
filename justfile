# Use bash with strict flags
set shell := ["bash", "-eu", "-o", "pipefail", "-c"]
set quiet := true
set dotenv-path := "dev.env"

# Read everything from .env (no inline defaults)
compose_file := env("COMPOSE_FILE")
docker_container_name := env("DOCKER_CONTAINER_NAME")
local_image := env("LOCAL_IMAGE")
local_tag := env("LOCAL_TAG")
dockerfile := env("DOCKERFILE")
build_cache_dir := env("BUILD_CACHE_DIR")
build_cache_git := env("BUILD_CACHE_GIT")
build_cache_reg := env("BUILD_CACHE_REG")
build_cache_tgt := env("BUILD_CACHE_TGT")
docker_builder_name := env("DOCKER_BUILDER_NAME")
redis_service := env("REDIS_SERVICE_NAME")
app_service := env("APP_SERVICE_NAME")
redis_health_timeout := env("REDIS_HEALTH_TIMEOUT")

default:
	@just --list

# Start only Redis from compose, in the background.
redis-up:
	@echo "Starting Redis (from {{ compose_file }})..."
	docker compose -f {{ compose_file }} up -d {{ redis_service }}

# Stop only the Redis service (container remains, not removed).
redis-down:
	@echo "Stopping Redis (from {{ compose_file }})..."
	docker compose -f {{ compose_file }} stop {{ redis_service }}

# Wait on Redis to be healthy: returns 0 when healthy; non-zero if timeout.
_redis-wait:
	@echo "Waiting up to {{ redis_health_timeout }}s for Redis to become healthy..."
	# Try redis-cli ping inside the service until it replies PONG or we time out.
	end=$$((SECONDS + {{ redis_health_timeout }})); \
	while [ $$SECONDS -lt $$end ]; do \
		if docker compose -f {{ compose_file }} exec -T {{ redis_service }} sh -lc 'redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG'; then \
			echo "Redis is healthy."; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "Timed out waiting for Redis health."; \
	exit 1

# View Redis logs (Ctrl+C to exit).
redis-logs:
	@echo "Tailing Redis logs..."
	docker compose -f {{ compose_file }} logs -f --tail=200 {{ redis_service }}

# Buildx bootstrap and cache dirs (so Rust layers persist)
_buildx-bootstrap:
	mkdir -p {{ build_cache_dir }}
	if ! docker buildx inspect {{ docker_builder_name }} >/dev/null 2>&1; then \
		docker buildx create --name {{ docker_builder_name }} --driver docker-container --use; \
	else \
		docker buildx use {{ docker_builder_name }}; \
	fi
	docker buildx inspect --bootstrap >/dev/null

# Build docker image & tag (with BuildKit cache so Rust won't rebuild from scratch)
docker-build: _buildx-bootstrap
	DOCKER_BUILDKIT=1 docker buildx build \
	  --builder {{ docker_builder_name }} \
	  --file "{{ dockerfile }}" \
	  --tag "{{ docker_container_name }}:{{ local_tag }}" \
	  --build-arg BUILDKIT_INLINE_CACHE=1 \
	  --cache-from type=local,src={{ build_cache_dir }} \
	  --cache-to   type=local,dest={{ build_cache_dir }},mode=max \
	  --progress=plain \
	  .

# Tag an existing local image with a new tag: `just tag from=latest to=v0.1.1`
tag from="{{local_tag}}" to="{{local_tag}}":
	@echo "Tagging {{ local_image }}:{{ from }} -> {{ local_image }}:{{ to }} ..."
	docker tag {{ local_image }}:{{ from }} {{ local_image }}:{{ to }}

# Build & start docker: (re)build image, start redis, wait healthy, then start app
docker-up:
	just docker-build
	just redis-up
	just _redis-wait
	@echo "Starting {{ app_service }} (from {{ compose_file }})..."
	docker compose -f {{ compose_file }} up -d {{ app_service }}

# Stop the whole stack (convenience): stops both services without removing them.
docker-down:
	@echo "Stopping services ({{ redis_service }}, {{ app_service }}) ..."
	docker compose -f {{ compose_file }} stop {{ redis_service }} {{ app_service }}

# Remove containers (but keep images & volumes).
docker-clean:
	@echo "Removing service containers ..."
	docker compose -f {{ compose_file }} rm -fsv {{ redis_service }} {{ app_service }} || true

# Show current compose status
docker-ps:
	docker compose -f {{ compose_file }} ps

# Local dev build/run via Cargo
build:
	cargo build

run:
	just build
	just redis-up
	just _redis-wait
	@echo "Starting {{ app_service }} (local build)..."
	cargo run

# Format source code (Rust, Justfile, and TOMLs)
fmt:
	cargo fmt # *.rs
	just --quiet --unstable --fmt > /dev/null # justfile
	taplo format > /dev/null 2>&1 # *.toml
