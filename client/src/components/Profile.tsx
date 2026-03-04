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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                alert('File is too large! Please choose an image under 1MB.');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setEditedPicture(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
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
                            src={editedPicture || 'https://via.placeholder.com/150'}
                            alt={user.name}
                            className="profile-picture"
                        />
                        {isEditing && (
                            <label className="avatar-edit-overlay clickable">
                                <span>Upload New</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
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
                                <label>Profile Image Source</label>
                                <div className="image-input-container">
                                    {editedPicture.startsWith('data:') ? (
                                        <div className="local-upload-status">
                                            <span>📷 Local Image Selected</span>
                                            <button
                                                className="clear-img-btn"
                                                onClick={() => setEditedPicture(user.picture || '')}
                                            >
                                                Undo Upload
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={editedPicture}
                                            placeholder="Paste image URL here..."
                                            onChange={(e) => setEditedPicture(e.target.value)}
                                            className="edit-input"
                                        />
                                    )}
                                </div>
                                <span className="input-hint">Click the avatar to upload a local file instead</span>
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
