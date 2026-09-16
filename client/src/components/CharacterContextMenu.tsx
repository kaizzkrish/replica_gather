import React, { useEffect, useState } from 'react';
import '../styles/characterContextMenu.css';

interface CharacterContextMenuProps {
    onCustomize: () => void;
}

const MENU_WIDTH = 170;
const MENU_HEIGHT = 46;

const CharacterContextMenu: React.FC<CharacterContextMenuProps> = ({ onCustomize }) => {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleOpen = (e: Event) => {
            const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
            if (!detail) return;
            const x = Math.min(detail.x, window.innerWidth - MENU_WIDTH - 8);
            const y = Math.min(detail.y, window.innerHeight - MENU_HEIGHT - 8);
            setPos({ x, y });
        };
        const close = () => setPos(null);
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };

        window.addEventListener('character-context-menu', handleOpen);
        window.addEventListener('keydown', handleKey);
        window.addEventListener('blur', close);
        window.addEventListener('game-zoom', close);
        return () => {
            window.removeEventListener('character-context-menu', handleOpen);
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('blur', close);
            window.removeEventListener('game-zoom', close);
        };
    }, []);

    if (!pos) return null;

    return (
        <div
            className="char-ctx-backdrop"
            onMouseDown={() => setPos(null)}
            // On Windows/Chrome, right-click fires `contextmenu` on mouseUP —
            // by then this backdrop already exists over the character (it
            // was rendered synchronously from the mouseDOWN that opened this
            // same menu), so this handler also receives that trailing event.
            // It must only suppress the native menu, never close ours —
            // closing here would dismiss the menu in the same gesture that
            // just opened it. Actual dismissal is handled by onMouseDown
            // above, which fires on any *new* click before this can.
            onContextMenu={(e) => e.preventDefault()}
        >
            <div
                className="char-ctx-menu"
                style={{ left: pos.x, top: pos.y }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="char-ctx-item"
                    onClick={() => { onCustomize(); setPos(null); }}
                >
                    <i className="ph-bold ph-palette"></i>
                    Customize
                </button>
            </div>
        </div>
    );
};

export default CharacterContextMenu;
