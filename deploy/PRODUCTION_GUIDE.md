# Production Deployment Guide for ourlittlespace.in

This guide explains how to set up your application on AWS with Nginx and SSL.

## 1. AWS EC2 Instance Setup
1.  **Launch Instance**: Use **Ubuntu 22.04 LTS**.
2.  **Security Group**: Open the following ports:
    *   `SSH` (22) - your IP
    *   `HTTP` (80) - 0.0.0.0/0
    *   `HTTPS` (443) - 0.0.0.0/0
3.  **Elastic IP**: Allocate and associate an Elastic IP with your instance to prevent the IP from changing.

## 2. Domain DNS Configuration
- In your domain provider (e.g., Namecheap, GoDaddy):
    - Create an **A Record** for `ourlittlespace.in` pointing to your EC2 Elastic IP.
    - Create an **A Record** for `www.ourlittlespace.in` pointing to your EC2 Elastic IP.

## 3. Server Preparation
Connect to your EC2 via SSH and run:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Logout and log back in for changes to take effect

# Clone your repository
git clone <your-repo-url>
cd replica_gather
```

## 4. Initial SSL Certificate Generation
Before starting the full stack, you need to generate the SSL certificates. There is a "chicken-and-egg" problem: Nginx won't start without certificates, but you need Nginx (or another server) to get them.

**Option A: The Standalone Method (Easiest)**
*Ensure port 80 is not being used by any process (like a local Nginx).*
```bash
docker run -it --rm --name certbot \
  -p 80:80 \
  -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --standalone \
  -d ourlittlespace.in -d www.ourlittlespace.in \
  --email your-email@example.com --agree-tos --no-eff-email
```

**Option B: The Webroot Method**
If you have Nginx already running:
```bash
docker run -it --rm --name certbot \
  -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d ourlittlespace.in -d www.ourlittlespace.in \
  --email your-email@example.com --agree-tos --no-eff-email
```

## 5. Launch Application
Once certificates are successfully generated in `deploy/certbot/conf/live/ourlittlespace.in/`, launch the production stack:
```bash
# Build and start all services (db, server, client, nginx, certbot)
docker compose -f docker-compose.prod.yml up -d --build
```

## 6. Automatic Renewal
The `docker-compose.prod.yml` includes a `certbot` container that checks for renewal every 12 hours.
To manually test renewal:
```bash
docker compose -f docker-compose.prod.yml exec certbot certbot renew --dry-run
```

## Troubleshooting
- **Logs**: Check Nginx logs with `docker compose logs nginx`.
- **Ports**: Ensure nothing else is listening on port 80/443 on the host.
- **Firewall**: Check `ufw status` on Ubuntu.
