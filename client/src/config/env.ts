// Global environment configuration handler

export const isDev = import.meta.env.DEV;

// Detect if running on an IP address (AWS Production)
export const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname);
export const isProductionAWS = isIP || window.location.hostname !== 'localhost';

/**
 * Automatically calculates the correct API and Socket URL based on the environment.
 * Dev: localhost:707 (or VITE_API_URL)
 * Prod (AWS): Current Public IP on port 707
 */
export const getApiBase = () => {
    // 1. Check if user provided an override via .env
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && envUrl !== 'http://localhost:3001' && envUrl !== 'http://localhost:707') {
        return envUrl;
    }

    // 2. Production AWS: Use current hostname + port 707
    if (isProductionAWS) {
        return `http://${window.location.hostname}:707`;
    }

    // 3. Local Development (Normal mode)
    // Default to port 707 since that's what we are using in Docker now
    return 'http://localhost:707';
};

export const API_BASE = getApiBase();
export const SOCKET_URL = API_BASE;
