import React, { useEffect, useState } from 'react';
import '../styles/petPanel.css';
import { PET_BREEDS } from '../game/petCatalog';
import type { PetGrowthStage } from '../game/petCatalog';

interface PetPanelProps {
    currUser: any;
    onClose: () => void;
}

interface PetState {
    ownerUserId: string;
    nickname: string;
    breedId: string;
    growthStage: PetGrowthStage;
    hunger: number;
    energy: number;
    bond: number;
    mode: 'idle' | 'following' | 'sleeping';
}

const GROWTH_LABEL: Record<PetGrowthStage, string> = {
    baby: 'Baby',
    juvenile: 'Juvenile',
    adult: 'Adult',
};

const PetPanel: React.FC<PetPanelProps> = ({ currUser, onClose }) => {
    const [pet, setPet] = useState<PetState | null>(null);
    const [nicknameInput, setNicknameInput] = useState('');
    const [breedId, setBreedId] = useState(PET_BREEDS[0].id);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [confirmingRemove, setConfirmingRemove] = useState(false);

    useEffect(() => {
        const handlePetState = (e: Event) => {
            const detail = (e as CustomEvent<PetState>).detail;
            if (detail?.ownerUserId === currUser?.sub) setPet(detail);
        };
        const handlePetRemoved = (e: Event) => {
            const detail = (e as CustomEvent<{ ownerUserId: string }>).detail;
            if (detail?.ownerUserId === currUser?.sub) {
                setPet(null);
                setConfirmingRemove(false);
            }
        };
        window.addEventListener('pet-state', handlePetState);
        window.addEventListener('pet-removed', handlePetRemoved);
        window.dispatchEvent(new CustomEvent('pet-request-state'));
        return () => {
            window.removeEventListener('pet-state', handlePetState);
            window.removeEventListener('pet-removed', handlePetRemoved);
        };
    }, [currUser?.sub]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const sendCommand = (action: string, extra?: Record<string, string>) => {
        window.dispatchEvent(new CustomEvent('pet-command', { detail: { action, ...extra } }));
    };

    const handleAdopt = () => {
        const nickname = nicknameInput.trim();
        if (!nickname) return;
        sendCommand('adopt', { nickname, breedId });
    };

    const handleRenameSave = () => {
        const nickname = renameValue.trim();
        if (nickname) sendCommand('rename', { nickname });
        setIsRenaming(false);
    };

    return (
        <div className="pp-overlay" onClick={onClose}>
            <div className="pp-card" role="dialog" aria-modal="true" aria-labelledby="pp-title" onClick={(e) => e.stopPropagation()}>
                <header className="pp-header">
                    <h2 id="pp-title" className="pp-title">🐾 My Pet</h2>
                </header>

                <div className="pp-content">
                    {!pet ? (
                        <>
                            <p className="pp-intro">Adopt a pet to keep you company around the space.</p>
                            <label className="pp-field-label" htmlFor="pp-breed">Breed</label>
                            <select
                                id="pp-breed"
                                className="pp-select"
                                value={breedId}
                                onChange={(e) => setBreedId(e.target.value)}
                            >
                                {PET_BREEDS.map((b) => (
                                    <option key={b.id} value={b.id}>{b.label}</option>
                                ))}
                            </select>

                            <label className="pp-field-label" htmlFor="pp-nickname">Nickname</label>
                            <input
                                id="pp-nickname"
                                className="pp-input"
                                value={nicknameInput}
                                onChange={(e) => setNicknameInput(e.target.value)}
                                placeholder="e.g. Bubbles"
                                maxLength={100}
                            />

                            <button className="pp-primary-btn" onClick={handleAdopt} disabled={!nicknameInput.trim()}>
                                Adopt
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="pp-identity">
                                {isRenaming ? (
                                    <input
                                        className="pp-input"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
                                        autoFocus
                                        maxLength={100}
                                    />
                                ) : (
                                    <h3 className="pp-name" onClick={() => { setRenameValue(pet.nickname); setIsRenaming(true); }} title="Click to rename">
                                        {pet.nickname}
                                    </h3>
                                )}
                                <span className="pp-stage-badge">{GROWTH_LABEL[pet.growthStage]}</span>
                            </div>

                            {isRenaming && (
                                <div className="pp-edit-actions">
                                    <button className="save-btn" onClick={handleRenameSave}>Save</button>
                                    <button className="cancel-btn" onClick={() => setIsRenaming(false)}>Cancel</button>
                                </div>
                            )}

                            <div className="pp-stats">
                                <div className="pp-stat">
                                    <span className="pp-stat-label">Hunger</span>
                                    <div className="pp-bar"><div className="pp-bar-fill pp-bar-hunger" style={{ width: `${pet.hunger}%` }} /></div>
                                </div>
                                <div className="pp-stat">
                                    <span className="pp-stat-label">Energy</span>
                                    <div className="pp-bar"><div className="pp-bar-fill pp-bar-energy" style={{ width: `${pet.energy}%` }} /></div>
                                </div>
                                <div className="pp-stat">
                                    <span className="pp-stat-label">Bond</span>
                                    <div className="pp-bar"><div className="pp-bar-fill pp-bar-bond" style={{ width: `${Math.min(100, pet.bond)}%` }} /></div>
                                </div>
                            </div>

                            <div className="pp-actions">
                                <button className="pp-action-btn" onClick={() => sendCommand('feed')}>Feed</button>
                                <button
                                    className={`pp-action-btn ${pet.mode === 'following' ? 'active' : ''}`}
                                    onClick={() => sendCommand(pet.mode === 'following' ? 'idle' : 'follow')}
                                >
                                    {pet.mode === 'following' ? 'Stop Following' : 'Follow Me'}
                                </button>
                                <button
                                    className={`pp-action-btn ${pet.mode === 'sleeping' ? 'active' : ''}`}
                                    onClick={() => sendCommand(pet.mode === 'sleeping' ? 'idle' : 'sleep')}
                                >
                                    {pet.mode === 'sleeping' ? 'Wake Up' : 'Sleep'}
                                </button>
                            </div>

                            {confirmingRemove ? (
                                <div className="pp-remove-confirm">
                                    <p className="pp-remove-text">Remove {pet.nickname}? This can't be undone.</p>
                                    <div className="pp-edit-actions">
                                        <button className="pp-danger-btn" onClick={() => sendCommand('remove')}>
                                            Yes, remove
                                        </button>
                                        <button className="cancel-btn" onClick={() => setConfirmingRemove(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button className="pp-remove-link" onClick={() => setConfirmingRemove(true)}>
                                    Remove Pet
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PetPanel;
