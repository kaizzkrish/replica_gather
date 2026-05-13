import React, { useState } from 'react';
import { API_BASE } from '../config/env';
import '../styles/auth.css';
import brandHeroImg from '../assets/images/login-screen-placeholder.png';

const Auth: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
        const payload = isLogin ? { username, password } : { username, password, name };

        try {
            const apiBase = API_BASE;
            const res = await fetch(`${apiBase}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Auth failed');

            // Success: Save user to local storage and refresh
            localStorage.setItem('replica_user', JSON.stringify(data));
            window.location.reload();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            {/* Animated Background Elements */}
            {/* <div className="bg-decorations">
                <div className="chase-sequence">
                    <div className="decor-item star-target">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L14.5 9.5H22L16 14L18.5 21.5L12 17L5.5 21.5L8 14L2 9.5H9.5L12 2Z" fill="#ffd180" fillOpacity="0.9"/>
                        </svg>
                    </div>
                    <div className="decor-item cat-chaser">
                        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" fill="white" fillOpacity="0.6"/>
                            <path d="M7 8L5 4L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M17 8L19 4L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="9" cy="11" r="1.5" fill="#4a345e"/>
                            <circle cx="15" cy="11" r="1.5" fill="#4a345e"/>
                            <path d="M11 14L12 15L13 14" stroke="#4a345e" strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <div className="decor-item dog-chaser">
                        <svg width="55" height="55" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" fill="white" fillOpacity="0.5"/>
                            <path d="M4 10C4 10 2 12 2 15C2 18 4 18 4 18" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                            <path d="M20 10C20 10 22 12 22 15C22 18 20 18 20 18" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                            <circle cx="9" cy="12" r="1.5" fill="#4a345e"/>
                            <circle cx="15" cy="12" r="1.5" fill="#4a345e"/>
                            <circle cx="12" cy="15" r="2" fill="#4a345e"/>
                        </svg>
                    </div>
                </div>
            </div> */}

            <div className="auth-visual-side">
                <div className="visual-overlay"></div>
                <div className="brand-content">
                    <img src={brandHeroImg} alt="Our Little Space" className="brand-hero-img" />
                    <h1 className="brand-tagline">Step into <br /><span>Our Little Space.</span></h1>
                    <p className="brand-description">Experience the next generation of virtual collaboration.</p>
                </div>
            </div>
            
            <div className="auth-form-side">
                <div className="auth-form-card">
                    <div className="auth-header">
                        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                        <p>{isLogin ? 'Enter your details to continue' : 'Join our growing community today'}</p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        {error && <div className="auth-error">{error}</div>}
                        
                        {!isLogin && (
                            <div className="form-group floating">
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)} 
                                    placeholder=" "
                                    id="fullname"
                                    required 
                                />
                                <label htmlFor="fullname">Full Name</label>
                            </div>
                        )}

                        <div className="form-group floating">
                            <input 
                                type="text" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                placeholder=" "
                                id="username"
                                required 
                            />
                            <label htmlFor="username">Username</label>
                        </div>

                        <div className="form-group floating password-group">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                placeholder=" "
                                id="password"
                                required 
                            />
                            <label htmlFor="password">Password</label>
                            <button 
                                type="button" 
                                className="password-toggle" 
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <i className="ph ph-eye"></i>
                                ) : (
                                    <i className="ph ph-eye-slash"></i>
                                )}
                            </button>
                        </div>

                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <span className="loader"></span>
                            ) : (
                                <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            {isLogin ? "Don't have an account?" : "Already have an account?"}
                            <button className="auth-toggle-btn" onClick={() => setIsLogin(!isLogin)}>
                                {isLogin ? 'Sign Up' : 'Sign In'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
