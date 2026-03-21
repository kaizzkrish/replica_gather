import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

interface ProfileProps {
    socket: Socket | null;
    currUser: any;
    onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ socket, currUser, onClose }) => {
    const { logout } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(currUser?.name || '');
    const [editedPicture, setEditedPicture] = useState(currUser?.picture || '');
    const [customization, setCustomization] = useState(currUser?.customization || {
        skinColor: '#ffffff', // Default white (no tint)
        hairColor: '#ffffff',
        hairStyle: 'default',
        outfitColor: '#ffffff',
        outfitId: 'basic',
        gender: 'male'
    });

    if (!currUser) return null;

    const handleSave = () => {
        if (socket) {
            socket.emit('updateProfile', {
                name: editedName,
                picture: editedPicture,
                customization: customization
            });
        }
        setIsEditing(false);
    };

    const handleGenderChange = (gender: 'male' | 'female') => {
        setCustomization((prev: any) => ({ ...prev, gender }));
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

    const handleRemovePicture = () => {
        setEditedPicture(''); // Reset to default placeholder
    };

    return (
        <div className="profile-overlay" onClick={onClose}>
            <div className="profile-card premium-card" onClick={(e) => e.stopPropagation()}>
                <div className="profile-header">
                    <button className="close-btn" onClick={onClose}>×</button>
                    <h2>Account Settings</h2>
                </div>

                <div className="profile-content">
                    <div className="profile-avatar-center">
                        <div className="avatar-wrapper">
                            <img
                                src={editedPicture || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png'}
                                alt=""
                                className="profile-avatar-large"
                            />
                            {isEditing && (
                                <div className="avatar-edit-controls">
                                    <label className="icon-action-btn">
                                        📷
                                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                    </label>
                                    {editedPicture && (
                                        <button className="icon-action-btn delete" onClick={handleRemovePicture}>🗑️</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="input-group">
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={editedName}
                                disabled={!isEditing}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="What's your name?"
                                className="premium-input"
                            />
                        </div>

                        <div className="input-group">
                            <label>In-Game Character</label>
                            <div className="gender-toggle-buttons">
                                <button 
                                    className={`gender-btn ${customization.gender === 'male' ? 'active' : ''}`}
                                    disabled={!isEditing}
                                    onClick={() => handleGenderChange('male')}
                                >
                                    👦 Male
                                </button>
                                <button 
                                    className={`gender-btn ${customization.gender === 'female' ? 'active' : ''}`}
                                    disabled={!isEditing}
                                    onClick={() => handleGenderChange('female')}
                                >
                                    👧 Female
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="profile-footer-v2">
                    {isEditing ? (
                        <div className="auth-btn-row">
                            <button onClick={handleSave} className="save-btn-p">Save Changes</button>
                            <button onClick={() => setIsEditing(false)} className="cancel-btn-p">Discard</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="edit-p-btn">Edit Profile</button>
                    )}
                    
                    <div className="footer-links">
                        <button onClick={() => logout()} className="p-signout-btn">Sign Out</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
