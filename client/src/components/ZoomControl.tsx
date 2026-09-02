import React, { useEffect, useState } from 'react';
import '../styles/zoom-control.css';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const STEP = 0.1;

const ZoomControl: React.FC = () => {
  const [zoom, setZoom] = useState(1);

  // Keep the slider in sync when zoom changes via mouse wheel or pinch gestures
  useEffect(() => {
    const handleSync = (e: Event) => {
      const value = (e as CustomEvent<{ zoom: number }>).detail?.zoom;
      if (typeof value === 'number') setZoom(Number(value.toFixed(2)));
    };
    window.addEventListener('game-zoom-sync', handleSync);
    return () => window.removeEventListener('game-zoom-sync', handleSync);
  }, []);

  const applyZoom = (value: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
    setZoom(clamped);
    window.dispatchEvent(new CustomEvent('game-zoom', { detail: { zoom: clamped } }));
  };

  return (
    <div className="zoom-control">
      <button
        className="zoom-btn"
        onClick={() => applyZoom(zoom - STEP)}
        disabled={zoom <= MIN_ZOOM}
        title="Zoom out"
      >
        <i className="ph-bold ph-minus"></i>
      </button>

      <input
        type="range"
        className="zoom-slider"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={STEP}
        value={zoom}
        onChange={(e) => applyZoom(Number(e.target.value))}
        title="Zoom"
      />

      <button
        className="zoom-btn"
        onClick={() => applyZoom(zoom + STEP)}
        disabled={zoom >= MAX_ZOOM}
        title="Zoom in"
      >
        <i className="ph-bold ph-plus"></i>
      </button>

      <span className="zoom-value">{Math.round(zoom * 100)}%</span>
    </div>
  );
};

export default ZoomControl;
