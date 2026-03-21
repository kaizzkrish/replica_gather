export const isSecureOrigin = () => {
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

export const useAuth = () => {
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
                username: user.username
            },
            isLoading: false,
            logout: () => {
                localStorage.removeItem('replica_user');
                window.location.reload();
            }
        };
    }

    // Support old guest mode as fallback if needed
    const isGuest = new URLSearchParams(window.location.search).get('guest') === 'true';
    if (isGuest) {
        return {
            isAuthenticated: true,
            user: {
                sub: 'guest',
                name: 'Guest Explorer',
                picture: 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png',
                email: 'guest@example.com'
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
}
