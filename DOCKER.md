## Docker Setup for Localestia

This guide explains how to build and run your Localestia application using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

1. Build and start the services:

```bash
docker-compose up -d
```

This will:

- Start a Redis instance
- Build and start your Localestia application
- Make the API available at <http://localhost:26658>

1. Check the logs:

```bash
docker compose logs -f localestia
```

1. Stop the services:

```bash
docker compose down
```

## Configuration

You can configure the application through environment variables in the `docker-compose.yaml` file:

```yaml
environment:
  - REDIS_URL=redis://redis:6379
  - LISTEN_ADDR=0.0.0.0:26658
  - CLEAR_REDIS=true
```

### Environment Variables

- `REDIS_URL`: Connection string for Redis
- `LISTEN_ADDR`: Address and port your API listens on
- `CLEAR_REDIS`: Whether to clear Redis on startup

## Data Persistence

Redis data is stored in a Docker volume `redis-data`. To completely reset the data:

```bash
docker-compose down -v
```

## Building for Production

For production deployments, you can build a Docker image:

```bash
docker build -t localestia:latest .
```

This creates an optimized image that you can deploy to any Docker-compatible environment.

## Customization

### Using External Redis

If you want to use an external Redis instance instead of the Docker container:

1. Remove the `redis` service from `docker-compose.yaml`
2. Update the `REDIS_URL` in the localestia service

```yaml
environment:
  - REDIS_URL=redis://your-redis-host:6379
```

### Changing Ports

To expose your API on a different port:

```yaml
ports:
  - "8080:26658"  # Maps host port 8080 to container port 26658
```
