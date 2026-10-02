import React, { useEffect, useState } from 'react';
import '../styles/characterContextMenu.css';

const MENU_WIDTH = 170;
const MENU_HEIGHT = 46;

interface OtherPlayerDetail {
    x: number;
    y: number;
    userId: string;
    name: string;
    picture?: string;
    withinRange: boolean;
}

const PlayerContextMenu: React.FC = () => {
    const [state, setState] = useState<OtherPlayerDetail | null>(null);

    useEffect(() => {
        const handleOpen = (e: Event) => {
            const detail = (e as CustomEvent<OtherPlayerDetail>).detail;
            if (!detail) return;
            const x = Math.min(detail.x, window.innerWidth - MENU_WIDTH - 8);
            const y = Math.min(detail.y, window.innerHeight - MENU_HEIGHT - 8);
            setState({ ...detail, x, y });
        };
        const close = () => setState(null);
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

        window.addEventListener('other-character-context-menu', handleOpen);
        window.addEventListener('keydown', handleKey);
        window.addEventListener('blur', close);
        window.addEventListener('game-zoom', close);
        return () => {
            window.removeEventListener('other-character-context-menu', handleOpen);
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('blur', close);
            window.removeEventListener('game-zoom', close);
        };
    }, []);

    if (!state || !state.withinRange) return null;

    return (
        <div
            className="char-ctx-backdrop"
            onMouseDown={() => setState(null)}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div
                className="char-ctx-menu"
                style={{ left: state.x, top: state.y }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="char-ctx-item"
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('call-request', {
                            detail: { userId: state.userId, name: state.name, picture: state.picture }
                        }));
                        setState(null);
                    }}
                >
                    <i className="ph-bold ph-phone-call"></i>
                    Connect Audio
                </button>
            </div>
        </div>
    );
};

export default PlayerContextMenu;
