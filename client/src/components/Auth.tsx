import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const Auth: React.FC = () => {
    const { loginWithRedirect } = useAuth0();

    return (
        <div className="auth-overlay">
            <div className="auth-card">
                <div className="auth-header">
                    <h2>Welcome to Gather Replica</h2>
                    <p>Log in or Sign up to start exploring the virtual space</p>
                </div>

                <div className="auth-actions">
                    <button
                        onClick={() => loginWithRedirect()}
                        className="auth-submit-btn"
                    >
                        Log In / Sign Up
                    </button>
                    <p className="auth-footer-text">
                        Powered by Auth0
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;
