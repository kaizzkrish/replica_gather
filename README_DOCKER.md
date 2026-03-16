# Docker Setup for Replica Gather

This branch contains a Dockerized setup for the Replica Gather project, including the frontend, backend, and PostgreSQL database.

## Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

1. **Clone the repository and switch to this branch:**
   ```bash
   git checkout docker-setup
   ```

2. **Run the services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: [http://localhost:8080](http://localhost:8080)
   - Backend API: [http://localhost:3001](http://localhost:3001)

## Architecture

- **Client**: Served via Nginx on port 8080. It proxies requests to `/socket.io/` to the server container.
- **Server**: Node.js/TypeScript backend running on port 3001.
- **DB**: PostgreSQL 16 database.

## Environment Variables

The `docker-compose.yml` file defines default environment variables for the containers. You can modify them directly in the YAML file or create a `.env` file in the root directory.

- `DATABASE_URL`: Connection string for the database (managed by Docker Compose).
- `CORS_ORIGINS`: Allowed origins for CORS (default: `http://localhost:8080`).
- `PORT`: Port for the server (default: 3001).
