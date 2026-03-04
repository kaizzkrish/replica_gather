import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

interface ProfileProps {
    onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onClose }) => {
    const { user, logout } = useAuth0();

    if (!user) return null;

    return (
        <div className="profile-overlay" onClick={onClose}>
            <div className="profile-card" onClick={(e) => e.stopPropagation()}>
                <div className="profile-header">
                    <button className="close-btn" onClick={onClose}>×</button>
                    <h2>User Profile</h2>
                </div>

                <div className="profile-content">
                    <div className="profile-avatar-section">
                        <img
                            src={user.picture || 'https://via.placeholder.com/150'}
                            alt={user.name}
                            className="profile-picture"
                        />
                        <button className="edit-avatar-badge" title="Profile managed via Auth0">
                            i
                        </button>
                    </div>

                    <div className="profile-info">
                        <div className="info-group">
                            <label>Full Name</label>
                            <div className="info-value">{user.name}</div>
                        </div>

                        <div className="info-group">
                            <label>Email Address</label>
                            <div className="info-value">{user.email}</div>
                        </div>

                        <div className="info-group">
                            <label>Nickname</label>
                            <div className="info-value">{user.nickname || 'N/A'}</div>
                        </div>

                        <div className="info-group">
                            <label>Account Status</label>
                            <div className="info-value status-verified">
                                {user.email_verified ? 'Verified' : 'Pending Verification'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="profile-actions">
                    <button
                        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                        className="profile-logout-btn"
                    >
                        Sign Out
                    </button>
                    <p className="profile-note">
                        Note: Profile details are managed via your Auth0 dashboard.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Profile;
