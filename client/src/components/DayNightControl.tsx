import React, { useState } from 'react';
import '../styles/day-night-control.css';

export type DayNightMode = 'day' | 'morning' | 'night';

const MODES: { id: DayNightMode; label: string; icon: string }[] = [
    { id: 'day', label: 'Day', icon: 'ph-sun' },
    { id: 'morning', label: 'Morning', icon: 'ph-sun-horizon' },
    { id: 'night', label: 'Night', icon: 'ph-moon-stars' },
];

// Mirrors ZoomControl's pattern: a plain UI toggle that dispatches a
// window CustomEvent for GameScene to react to (GameScene owns the actual
// lighting effect — this component only tracks which mode is selected).
const DayNightControl: React.FC = () => {
    const [mode, setMode] = useState<DayNightMode>('day');

    const applyMode = (next: DayNightMode) => {
        setMode(next);
        window.dispatchEvent(new CustomEvent('day-night-mode', { detail: { mode: next } }));
    };

    return (
        <div className="day-night-control">
            {MODES.map((m) => (
                <button
                    key={m.id}
                    className={`day-night-btn ${mode === m.id ? 'active' : ''}`}
                    onClick={() => applyMode(m.id)}
                    title={m.label}
                >
                    <i className={`ph-bold ${m.icon}`}></i>
                    <span>{m.label}</span>
                </button>
            ))}
        </div>
    );
};

export default DayNightControl;
