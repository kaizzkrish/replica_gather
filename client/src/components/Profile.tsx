import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Socket } from 'socket.io-client';

interface ProfileProps {
    socket: Socket | null;
    onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ socket, onClose }) => {
    const { user, logout } = useAuth0();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(user?.name || '');
    const [editedPicture, setEditedPicture] = useState(user?.picture || '');

    if (!user) return null;

    const handleSave = () => {
        if (socket) {
            socket.emit('updateProfile', {
                name: editedName,
                picture: editedPicture
            });
        }
        setIsEditing(false);
    };

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
                            src={isEditing ? editedPicture : editedPicture || 'https://via.placeholder.com/150'}
                            alt={user.name}
                            className="profile-picture"
                        />
                        {isEditing && (
                            <div className="avatar-edit-overlay">
                                <span>Change URL below</span>
                            </div>
                        )}
                    </div>

                    <div className="profile-info">
                        <div className="info-group">
                            <label>Display Name</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    className="edit-input"
                                />
                            ) : (
                                <div className="info-value">{editedName}</div>
                            )}
                        </div>

                        {isEditing && (
                            <div className="info-group">
                                <label>Profile Image URL</label>
                                <input
                                    type="text"
                                    value={editedPicture}
                                    placeholder="Paste image URL here..."
                                    onChange={(e) => setEditedPicture(e.target.value)}
                                    className="edit-input"
                                />
                            </div>
                        )}

                        <div className="info-group">
                            <label>Email Address</label>
                            <div className="info-value email-readonly">{user.email}</div>
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
                    {isEditing ? (
                        <div className="edit-actions">
                            <button onClick={handleSave} className="save-btn">Save Changes</button>
                            <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="edit-profile-btn">Edit Profile</button>
                    )}

                    <button
                        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                        className="profile-logout-btn"
                    >
                        Sign Out
                    </button>
                    <p className="profile-note">
                        Session remains active for 30 days.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Profile;
