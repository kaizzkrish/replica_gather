#!/bin/bash

# Configuration
DOMAIN="ourlittlespace.in"
NGINX_HOST_CONF="./deploy/nginx/host.conf"
NGINX_AVAILABLE_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"

# 1. Start Docker Containers (using production mode)
echo "🚀 Starting Docker containers..."
sudo docker compose -f docker-compose.prod.yml up -d --build

# 2. Setup Nginx Host Config
if [ -f "$NGINX_HOST_CONF" ]; then
    echo "📄 Creating Nginx host config for $DOMAIN..."
    sudo cp "$NGINX_HOST_CONF" "$NGINX_AVAILABLE_DIR/$DOMAIN"
    sudo ln -sf "$NGINX_AVAILABLE_DIR/$DOMAIN" "$NGINX_ENABLED_DIR/$DOMAIN"
    
    echo "🔧 Testing Nginx configuration..."
    if sudo nginx -t; then
        echo "✅ Nginx test passed. Reloading..."
        sudo systemctl reload nginx
    else
        echo "❌ Nginx test failed! Check the configuration manually."
        exit 1
    fi
else
    echo "❌ Host config file $NGINX_HOST_CONF not found!"
    exit 1
fi

# 3. Handle SSL via Certbot (Host Level)
echo "🔒 Checking for SSL certificate..."
if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN; then
    echo "✅ SSL certificate setup successfully!"
else
    echo "⚠️ Certbot failed. Please check your domain DNS or run manually later."
fi

echo "🎉 Deployment for $DOMAIN is complete!"
