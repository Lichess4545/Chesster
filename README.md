# CHESSTER [![Build Status](https://github.com/Lichess4545/Chesster/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/Lichess4545/Chesster/actions/workflows/build.yml) [![Test Coverage](https://codeclimate.com/github/Lichess4545/Chesster/badges/coverage.svg)](https://codeclimate.com/github/Lichess4545/Chesster/coverage)

## Introduction

This bot was created to help moderate the Lichess45+45 league.

It has a simple interface that integrates our Slack team, with Lichess and Website HTTP API.

# Docker Development Environment

This repository contains Docker setup for a Node.js application with PostgreSQL running in the background.

## Setup

### Prerequisites

- Docker and Docker Compose installed on your machine

### Running the Development Environment

2. Start the services:

    ```bash
    docker-compose up
    ```

    This will:

    - Build your Node.js application with all dependencies (including dev dependencies)
    - Start PostgreSQL in the background
    - Wait for PostgreSQL to be ready
    - Run database migrations with `pnpm run migrate`
    - Start the application with `pnpm run start`

3. To run in detached mode (in the background):

    ```bash
    docker-compose up -d
    ```

4. To view logs when running in detached mode:

    ```bash
    docker-compose logs -f
    ```

### PostgreSQL Configuration

The PostgreSQL database is configured with:

- **Username**: chesster
- **Password**: scrappypulpitgourdehinders
- **Database Name**: chesster
- **Port**: 5432 (accessible on your host machine)
- \**Connection URL*pnpm postgresql://chesster:scrappypulpitgourdehinders@localhst:5432/chesster

### Stopping the Environment

```bash
docker-compose down
```

To remove volumes as well (this will delete your database data):

```bash
docker-compose down -v
```

## Development Workflow

- The application code is mounted as a volume, so changes to your source files will be reflected in the container.
- The node_modules directory is preserved in the container to avoid conflicts with your local environment.
- Dev dependencies are installed by default to support development workflows.
- For pnpm commands, you can run them using `docker-compose exec`:

    ```bash
    docker-compose exec app pnpm add some-package
    ```

### Running Migrations Manually

If you need to run migrations manually (for example, after adding a new migration file):

```bash
docker-compose exec app pnpm run migrate
```

### Adding New Dev Dependencies

To add new development dependencies:

```bash
docker-compose exec app pnpm add --dev new-dev-package
```

## Useful Commands

Run these before submitting a PR:

```bash
docker-compose exec app pnpm test
```

```bash
docker-compose exec app pnpm run lint
```

## Website Integration

This bot utilizes the heltour api from this repo: <https://github.com/cyanfish/heltour/>
You will need to create a token from an installation of this app in order to access and manipulate data.

The bot should now be available for addition to your Slack Team.
