import { useMemo } from 'react';

export const isSecureOrigin = () => {
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

export const useAuth = () => {
    return useMemo(() => {
        // Check local storage for the new custom auth
        const storedUser = localStorage.getItem('replica_user');
        
        if (storedUser) {
            const user = JSON.parse(storedUser);
            return {
                isAuthenticated: true,
                user: {
                    sub: user.id, // Map 'id' to 'sub' for compatibility
                    name: user.name || user.username,
                    picture: user.picture || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png',
                    email: user.email || `${user.username}@local.home`,
                    username: user.username,
                    customization: user.customization
                },
                isLoading: false,
                logout: () => {
                    localStorage.removeItem('replica_user');
                    window.location.reload();
                }
            };
        }

        // Support old guest mode as fallback if needed
        const params = new URLSearchParams(window.location.search);
        const isGuest = params.get('guest') === 'true';
        if (isGuest) {
            // userId distinguishes separate guest sessions (e.g. two tabs
            // testing multiplayer) — without it every guest shares one
            // identity, one saved customization, and one DB row.
            const guestId = params.get('userId') || '1';
            return {
                isAuthenticated: true,
                user: {
                    sub: `guest-${guestId}`,
                    name: `Guest Explorer ${guestId}`,
                    picture: 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png',
                    email: `guest-${guestId}@example.com`
                },
                isLoading: false,
                logout: () => {
                     window.location.href = window.location.origin;
                }
            };
        }

        return {
            isAuthenticated: false,
            user: null,
            isLoading: false,
            logout: () => {}
        };
    }, []);
}
