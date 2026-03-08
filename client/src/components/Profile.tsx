import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Socket } from 'socket.io-client';

interface ProfileProps {
    socket: Socket | null;
    currUser: any;
    onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ socket, currUser, onClose }) => {
    const { logout } = useAuth0();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(currUser?.name || '');
    const [editedPicture, setEditedPicture] = useState(currUser?.picture || '');
    const [customization, setCustomization] = useState(currUser?.customization || {
        skinColor: '#ffdbac',
        hairColor: '#4b2c20',
        hairStyle: 'default',
        outfitColor: '#646cff',
        outfitId: 'basic'
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

    return (
        <div className="profile-overlay" onClick={onClose}>
            <div className="profile-card" onClick={(e) => e.stopPropagation()}>
                <div className="profile-header">
                    <button className="close-btn" onClick={onClose} style={{ padding: '0px' }}>×</button>
                    <h2>Edit Your Identity</h2>
                </div>

                <div className="profile-content">
                    <div className="profile-avatar-section">
                        <img
                            src={editedPicture || 'https://via.placeholder.com/150'}
                            alt={currUser.name}
                            className="profile-picture"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150';
                            }}
                        />
                        {isEditing && (
                            <label className="avatar-edit-overlay clickable">
                                <span>Change Photo</span>
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

                        <div className="customization-section">
                            <h3>Avatar Design</h3>
                            <div className="customization-grid">
                                <div className="color-item">
                                    <label>Skin Tone</label>
                                    <input
                                        type="color"
                                        value={customization.skinColor}
                                        disabled={!isEditing}
                                        onChange={(e) => handleColorChange('skinColor', e.target.value)}
                                    />
                                </div>
                                <div className="color-item">
                                    <label>Hair Color</label>
                                    <input
                                        type="color"
                                        value={customization.hairColor}
                                        disabled={!isEditing}
                                        onChange={(e) => handleColorChange('hairColor', e.target.value)}
                                    />
                                </div>
                                <div className="color-item">
                                    <label>Outfit Color</label>
                                    <input
                                        type="color"
                                        value={customization.outfitColor}
                                        disabled={!isEditing}
                                        onChange={(e) => handleColorChange('outfitColor', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="info-group">
                            <label>Email Address</label>
                            <div className="info-value email-readonly">{currUser.email}</div>
                        </div>
                    </div>
                </div>

                <div className="profile-actions">
                    {isEditing ? (
                        <div className="edit-actions">
                            <button onClick={handleSave} className="save-btn">Save Avatar</button>
                            <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="edit-profile-btn">Customize Look</button>
                    )}

                    <button
                        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                        className="profile-logout-btn"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
