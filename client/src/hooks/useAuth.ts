import { useAuth0 } from '@auth0/auth0-react';

export const isSecureOrigin = () => {
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

export const useAuth = () => {
    // If not a secure origin, or if guest mode is forced, return mock
    const isGuest = new URLSearchParams(window.location.search).get('guest') === 'true';

    if (!isSecureOrigin() || isGuest) {
        return {
            isAuthenticated: isGuest,
            user: isGuest ? {
                sub: 'guest',
                name: 'Guest Explorer',
                picture: 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png'
            } : null,
            isLoading: false
        };
    }

    // This will work on HTTPS or localhost
    // We wrap it in a try-catch for extra safety
    try {
        return useAuth0();
    } catch (e) {
        return { isAuthenticated: false, user: null, isLoading: false };
    }
}
