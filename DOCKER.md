## Docker Setup for Localestia

This guide explains how to build and run your Localestia application using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

1. Build a new image for localestia (pulls in any source changes):

```bash
docker build -t localestia:latest .
```

2. Start the services:

```bash
docker-compose up -d
```

This will:

- Start a Redis instance
- Start your Localestia application
- Make the API available at <http://localhost:26658>

3. Check the logs:

```bash
docker-compose logs -f localestia
```

3. Stop the services:

```bash
docker-compose down
```

## Configuration

You can configure the application through environment variables in the `docker-compose.yml` file:

```yaml
environment:
  REDIS_URL: ${REDIS_URL:-redis://redis:6379}
  LISTEN_ADDR: ${LISTEN_ADDR:-0.0.0.0:26658}
  CLEAR_REDIS: ${CLEAR_REDIS:-false}
```

### Environment Variables

- `REDIS_URL`: Connection string for Redis
- `LISTEN_ADDR`: Address and port your API listens on
- `CLEAR_REDIS`: Whether to clear Redis on startup

## Data Persistence

Redis data is _not_ persisted by default.
If you uncomment to enable that in [docker-compose.yaml](./docker-compose.yml), data is persisted in a `redis-data` Docker volume.
To completely reset the data:

```bash
docker-compose down -v
```

## Customization

### Using External Redis

If you want to use an external Redis instance instead of the Docker container:

1. Remove the `redis` service from `docker-compose.yml`
2. Update the `REDIS_URL` in the localestia service

```yaml
environment:
  - REDIS_URL=redis://your-redis-host:6379
```

### Changing Ports

To expose your API on a different port:

```yaml
ports:
  - "8080:26658" # Maps host port 8080 to container port 26658
```
