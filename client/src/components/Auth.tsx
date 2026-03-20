import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const Auth: React.FC = () => {
    const { loginWithRedirect } = useAuth0();

    return (
        <div className="auth-overlay">
            <div className="auth-card animated-home-card">
                <div className="auth-logo-container">
                    <img src="/home_logo.png" alt="Home" className="home-hero-logo" />
                </div>
                <div className="auth-header">
                    <h2>Welcome Home</h2>
                    <p>Step into your virtual workspace and explore the rooms.</p>
                </div>

                <div className="auth-actions">
                    <button
                        onClick={() => loginWithRedirect()}
                        className="auth-submit-btn explorer-btn"
                    >
                        Enter Virtual Home
                    </button>
                    <p className="auth-footer-text">
                        Kitchen • Dining • Office • Gaming
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;
