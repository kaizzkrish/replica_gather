import React, { useEffect, useState } from 'react';
import '../styles/characterContextMenu.css';

interface PetContextMenuProps {
    currUser: any;
}

interface PetState {
    ownerUserId: string;
    mode: 'idle' | 'following' | 'sleeping';
}

const MENU_WIDTH = 170;
const MENU_HEIGHT = 130;

const PetContextMenu: React.FC<PetContextMenuProps> = ({ currUser }) => {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [mode, setMode] = useState<PetState['mode']>('idle');

    useEffect(() => {
        const handlePetState = (e: Event) => {
            const detail = (e as CustomEvent<PetState>).detail;
            if (detail?.ownerUserId === currUser?.sub) setMode(detail.mode);
        };
        window.addEventListener('pet-state', handlePetState);
        window.dispatchEvent(new CustomEvent('pet-request-state'));
        return () => window.removeEventListener('pet-state', handlePetState);
    }, [currUser?.sub]);

    useEffect(() => {
        const handleOpen = (e: Event) => {
            const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
            if (!detail) return;
            const x = Math.min(detail.x, window.innerWidth - MENU_WIDTH - 8);
            const y = Math.min(detail.y, window.innerHeight - MENU_HEIGHT - 8);
            setPos({ x, y });
            window.dispatchEvent(new CustomEvent('pet-request-state'));
        };
        const close = () => setPos(null);
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

        window.addEventListener('pet-context-menu', handleOpen);
        window.addEventListener('keydown', handleKey);
        window.addEventListener('blur', close);
        window.addEventListener('game-zoom', close);
        return () => {
            window.removeEventListener('pet-context-menu', handleOpen);
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('blur', close);
            window.removeEventListener('game-zoom', close);
        };
    }, []);

    if (!pos) return null;

    const sendCommand = (action: string) => {
        window.dispatchEvent(new CustomEvent('pet-command', { detail: { action } }));
        setPos(null);
    };

    return (
        <div
            className="char-ctx-backdrop"
            onMouseDown={() => setPos(null)}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div
                className="char-ctx-menu"
                style={{ left: pos.x, top: pos.y }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <button className="char-ctx-item" onClick={() => sendCommand('feed')}>
                    <i className="ph-bold ph-bone"></i>
                    Feed
                </button>
                <button className="char-ctx-item" onClick={() => sendCommand(mode === 'following' ? 'idle' : 'follow')}>
                    <i className="ph-bold ph-footprints"></i>
                    {mode === 'following' ? 'Stop Following' : 'Follow Me'}
                </button>
                <button className="char-ctx-item" onClick={() => sendCommand(mode === 'sleeping' ? 'idle' : 'sleep')}>
                    <i className="ph-bold ph-moon-stars"></i>
                    {mode === 'sleeping' ? 'Wake Up' : 'Sleep'}
                </button>
            </div>
        </div>
    );
};

export default PetContextMenu;
