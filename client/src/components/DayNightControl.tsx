import React, { useState } from 'react';
import '../styles/day-night-control.css';

export type DayNightMode = 'day' | 'morning' | 'night';

// Morning is temporarily off the UI (kept in the type/event contract so it
// can be reinstated later) — the control is a simple Day/Night switch.
const DayNightControl: React.FC = () => {
    const [mode, setMode] = useState<DayNightMode>('day');

    const applyMode = (next: DayNightMode) => {
        setMode(next);
        window.dispatchEvent(new CustomEvent('day-night-mode', { detail: { mode: next } }));
    };

    const isNight = mode === 'night';

    return (
        <div className="day-night-control">
            <div className="dn-switch">
                <input
                    id="day-night-toggle"
                    type="checkbox"
                    checked={isNight}
                    onChange={(e) => applyMode(e.target.checked ? 'night' : 'day')}
                    aria-label={isNight ? 'Switch to day' : 'Switch to night'}
                />
                <label htmlFor="day-night-toggle" title={isNight ? 'Night' : 'Day'} />
            </div>
        </div>
    );
};

export default DayNightControl;
