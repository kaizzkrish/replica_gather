import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Socket } from 'socket.io-client';
import AvatarCustomizer from './AvatarCustomizer';
import type { Customization } from '../game/lpcCatalog';

interface ProfileProps {
    socket: Socket | null;
    currUser: any;
    onClose: () => void;
}

interface ProfileFieldProps {
    label: string;
    value: string;
    icon: string;
    masked?: boolean;
}

const ProfileField: React.FC<ProfileFieldProps> = ({ label, value, icon, masked }) => (
    <div className="pc-field">
        <span className="pc-field-label">{label}</span>
        <div className="pc-field-row">
            <span className="pc-field-value">{masked ? '•'.repeat(10) : value}</span>
            <i className={`ph ${icon} pc-field-icon`} aria-hidden="true"></i>
        </div>
    </div>
);

const Profile: React.FC<ProfileProps> = ({ socket, currUser, onClose }) => {
    const { logout } = useAuth0();
    const [isEditing, setIsEditing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editedName, setEditedName] = useState(currUser?.name || '');
    const [editedPicture, setEditedPicture] = useState(currUser?.picture || '');
    const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!currUser) return null;

    const handleSave = () => {
        if (socket) {
            socket.emit('updateProfile', {
                name: editedName,
                picture: editedPicture,
                customization: currUser.customization,
            });
        }
        setIsEditing(false);
    };

    const handleAvatarSave = (customization: Customization) => {
        if (socket) {
            socket.emit('updateProfile', {
                name: editedName,
                picture: editedPicture,
                customization,
            });
        }
        setShowAvatarCustomizer(false);
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

    const usernameHandle = currUser.username ? `@${currUser.username}` : (currUser.sub || '—');

    return (
        <div className="pc-overlay" onClick={onClose}>
            <div
                className="pc-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pc-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="pc-header">
                    <h2 id="pc-title" className="pc-title">Your Profile</h2>
                    <div className="pc-settings-wrap">
                        <button
                            type="button"
                            className="pc-settings-btn"
                            aria-label="Profile settings"
                            aria-haspopup="menu"
                            aria-expanded={showSettings}
                            onClick={() => setShowSettings((s) => !s)}
                        >
                            <i className="ph-bold ph-gear-six" aria-hidden="true"></i>
                        </button>
                        {showSettings && (
                            <div className="pc-settings-menu" role="menu">
                                <button
                                    role="menuitem"
                                    onClick={() => { setIsEditing(true); setShowSettings(false); }}
                                >
                                    Edit Name / Photo
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={() => { setShowAvatarCustomizer(true); setShowSettings(false); }}
                                >
                                    Customize Look
                                </button>
                                <button
                                    role="menuitem"
                                    className="pc-settings-danger"
                                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                                >
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="pc-content">
                    <div className="pc-avatar-ring">
                        <img
                            src={editedPicture || '/profile_icon.jpeg'}
                            alt={`${editedName || 'User'}'s avatar`}
                            className="pc-avatar"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/profile_icon.jpeg';
                            }}
                        />
                        {isEditing && (
                            <label className="pc-avatar-edit clickable">
                                <span>Change</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        )}
                    </div>

                    {isEditing ? (
                        <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="pc-name-input"
                            aria-label="Display name"
                        />
                    ) : (
                        <h3 className="pc-name">{editedName || 'Guest'}</h3>
                    )}
                    <p className="pc-role">Explorer</p>

                    <div className="pc-fields">
                        <ProfileField label="Email" value={currUser.email || '—'} icon="ph-envelope-simple" />
                        <ProfileField label="Username" value={usernameHandle} icon="ph-user" />
                        <ProfileField label="Password" value="" icon="ph-lock-key" masked />
                    </div>

                    {isEditing && (
                        <div className="pc-edit-actions">
                            <button onClick={handleSave} className="save-btn">Save Changes</button>
                            <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
                        </div>
                    )}
                </div>
            </div>

            {showAvatarCustomizer && (
                <AvatarCustomizer
                    socket={socket}
                    currUser={currUser}
                    onClose={() => setShowAvatarCustomizer(false)}
                    onSave={handleAvatarSave}
                />
            )}
        </div>
    );
};

export default Profile;
