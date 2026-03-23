# Production Deployment Guide: Internal Nginx Mode

This guide explains how to deploy using the Nginx configuration stored **inside your project code**.

## 1. How it works
- **Docker Nginx**: Manage your client/server routing within the code (`deploy/nginx/default.conf`).
- **Host Nginx**: The existing Nginx on your AWS server will receive traffic on port 80/443 and forward it to this project's Docker container on port **8080**.

## 2. Updated Project Stack
Run this in your project root to start everything:
```bash
cd ~/gather_replica/replica_gather/
docker compose -f docker-compose.prod.yml up -d --build
```
This will start your project's Nginx on **localhost:8080**.

## 3. Host Nginx "Bridge" Config
Update your host's Nginx at `/etc/nginx/sites-available/ourlittlespace.in` to point to the Docker Nginx:

```nginx
server {
    listen 80;
    server_name ourlittlespace.in www.ourlittlespace.in;

    location / {
        proxy_pass http://localhost:8080; # Point to our Project's Docker Nginx
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for Socket.io
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 4. Enable and add SSL (Host Level)
```bash
sudo ln -s /etc/nginx/sites-available/ourlittlespace.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Run Certbot to add SSL securely
sudo certbot --nginx -d ourlittlespace.in -d www.ourlittlespace.in
```

## 5. Summary
This method keeps your project's main logic (routing between frontend and backend) inside your code repository while letting the host server handle the SSL and port 80/443 mapping.
