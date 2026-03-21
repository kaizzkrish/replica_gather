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
        skinColor: '#ffdbac',
        hairColor: '#4b2c20',
        hairStyle: 'default',
        outfitColor: '#646cff',
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

    const handleColorChange = (key: string, value: string) => {
        setCustomization((prev: any) => ({ ...prev, [key]: value }));
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
                    <h2>Profile Settings</h2>
                </div>

                <div className="profile-content">
                    <div className="profile-top-row">
                        <div className="sidebar-avatar">
                            <img
                                src={editedPicture || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png'}
                                alt=""
                                className="profile-avatar-large"
                            />
                            {isEditing && (
                                <div className="avatar-actions-v2">
                                    <label className="action-label upload-btn">
                                        Change
                                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                    </label>
                                    {editedPicture && (
                                        <button className="remove-photo-btn" onClick={handleRemovePicture}>Remove</button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="main-info">
                            <div className="input-group">
                                <label>Your Name</label>
                                <input
                                    type="text"
                                    value={editedName}
                                    disabled={!isEditing}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="premium-input"
                                />
                            </div>

                            <div className="input-group">
                                <label>Character Type</label>
                                <div className="gender-toggle-buttons">
                                    <button 
                                        className={`gender-btn ${customization.gender === 'male' ? 'active' : ''}`}
                                        disabled={!isEditing}
                                        onClick={() => handleColorChange('gender', 'male')}
                                    >
                                        👦 Male
                                    </button>
                                    <button 
                                        className={`gender-btn ${customization.gender === 'female' ? 'active' : ''}`}
                                        disabled={!isEditing}
                                        onClick={() => handleColorChange('gender', 'female')}
                                    >
                                        👧 Female
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="customization-group">
                        <h3>Vibe & Style</h3>
                        <div className="mini-grid">
                            <div className="vibe-item">
                                <label>Skin</label>
                                <input
                                    type="color"
                                    value={customization.skinColor}
                                    disabled={!isEditing}
                                    onChange={(e) => handleColorChange('skinColor', e.target.value)}
                                />
                            </div>
                            <div className="vibe-item">
                                <label>Hair</label>
                                <input
                                    type="color"
                                    value={customization.hairColor}
                                    disabled={!isEditing}
                                    onChange={(e) => handleColorChange('hairColor', e.target.value)}
                                />
                            </div>
                            <div className="vibe-item">
                                <label>Suit</label>
                                <input
                                    type="color"
                                    value={customization.outfitColor}
                                    disabled={!isEditing}
                                    onChange={(e) => handleColorChange('outfitColor', e.target.value)}
                                />
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
                    
                    <button onClick={() => logout()} className="p-signout-btn">Sign Out</button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
