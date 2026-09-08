import React, { useState, useEffect, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { layerZIndex, REQUIRED_CATEGORIES, categoryOf, defaultCustomization } from '../game/lpcCatalog';
import type { Customization, CustomizationLayer } from '../game/lpcCatalog';
import '../styles/avatarCustomizer.css';

interface AvatarCustomizerProps {
    socket: Socket | null;
    currUser: any;
    onClose: () => void;
    onSave: (customization: Customization) => void;
}

// Which top-level catalog folders show up under each tab. 'body' is
// intentionally never shown here — it's set from presets/defaults only,
// matching the reference project.
const TABS: { label: string; categories: string[] }[] = [
    { label: 'Face', categories: ['head', 'eyes', 'facial', 'beards'] },
    { label: 'Hair', categories: ['hair'] },
    { label: 'Top', categories: ['torso', 'arms', 'shoulders'] },
    { label: 'Bottom', categories: ['legs'] },
    { label: 'Shoes', categories: ['feet'] },
    { label: 'Accessories', categories: ['hat', 'neck', 'dress', 'shield'] },
];

const PRESETS: { name: string; layers: CustomizationLayer[] }[] = [
    {
        name: 'Classic', layers: [
            { category: 'body', path: 'body/bodies/male/walk.png' },
            { category: 'head', path: 'head/heads/human/male/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/page/adult/walk.png' },
            { category: 'torso', path: 'torso/clothes/longsleeve/longsleeve2/teen/walk.png' },
            { category: 'legs', path: 'legs/pants2/thin/walk.png' },
            { category: 'feet', path: 'feet/shoes/basic/thin/walk.png' },
        ],
    },
    {
        name: 'Bright', layers: [
            { category: 'body', path: 'body/bodies/female/walk.png' },
            { category: 'head', path: 'head/heads/human/female/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/afro/adult/walk.png' },
            { category: 'torso', path: 'torso/clothes/shortsleeve/shortsleeve/female/walk.png' },
            { category: 'legs', path: 'legs/pants/thin/walk.png' },
            { category: 'feet', path: 'feet/shoes/sara/thin/walk.png' },
        ],
    },
    {
        name: 'Formal', layers: [
            { category: 'body', path: 'body/bodies/male/walk.png' },
            { category: 'head', path: 'head/heads/human/male/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/bangsshort/adult/walk.png' },
            { category: 'torso', path: 'torso/clothes/longsleeve/formal/male/walk.png' },
            { category: 'legs', path: 'legs/formal/male/walk.png' },
            { category: 'feet', path: 'feet/shoes/revised/male/walk.png' },
        ],
    },
    {
        name: 'Sporty', layers: [
            { category: 'body', path: 'body/bodies/male/walk.png' },
            { category: 'head', path: 'head/heads/human/male/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/bangslong/adult/walk.png' },
            { category: 'torso', path: 'torso/clothes/shortsleeve/shortsleeves/male/walk.png' },
            { category: 'legs', path: 'legs/pants/male/walk.png' },
            { category: 'feet', path: 'feet/shoes/ghillies/male/walk.png' },
        ],
    },
];

const CATALOG_URL = '/character-assets/catalog.json';
const SPRITE_BASE = '/character-assets/spritesheets/';
// Preview always faces 'down' — row index 2 in LPC_FRAME_LAYOUT.directions.
const PREVIEW_ROW = 2;

const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({ currUser, onClose, onSave }) => {
    const [catalog, setCatalog] = useState<string[]>([]);
    const [layers, setLayers] = useState<CustomizationLayer[]>(
        currUser?.customization?.layers ?? defaultCustomization().layers
    );
    const [activeTab, setActiveTab] = useState<number>(-1); // -1 = Presets
    const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

    useEffect(() => {
        fetch(CATALOG_URL)
            .then((r) => r.json())
            .then(setCatalog)
            .catch(() => setCatalog([]));
    }, []);

    const layerByCategory = useMemo(() => {
        const map: Record<string, CustomizationLayer> = {};
        layers.forEach((l) => { map[categoryOf(l.path)] = l; });
        return map;
    }, [layers]);

    const sortedForPreview = useMemo(
        () => [...layers].sort((a, b) => layerZIndex(a.path) - layerZIndex(b.path)),
        [layers]
    );

    const selectItem = (category: string, path: string | null) => {
        setLayers((prev) => {
            const withoutCategory = prev.filter((l) => categoryOf(l.path) !== category);
            if (path === null) return withoutCategory;
            const existing = prev.find((l) => categoryOf(l.path) === category);
            return [...withoutCategory, {
                category, path,
                hue: existing?.hue, saturation: existing?.saturation, brightness: existing?.brightness,
            }];
        });
        setFocusedCategory(category);
    };

    const updateColor = (category: string, field: 'hue' | 'saturation' | 'brightness', value: number) => {
        setLayers((prev) => prev.map((l) => (categoryOf(l.path) === category ? { ...l, [field]: value } : l)));
    };

    const handleSave = () => {
        onSave({ version: 2, layers });
    };

    const focusedLayer = focusedCategory ? layerByCategory[focusedCategory] : undefined;

    return (
        <div className="ac-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <div className="ac-card" onClick={(e) => e.stopPropagation()}>
                <div className="ac-header">
                    <h2>Customize Your Look</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="ac-body">
                    <div className="ac-preview-panel">
                        <div className="ac-preview-stage">
                            <div className="lpc-preview walking">
                                {sortedForPreview.map((layer) => (
                                    <div
                                        key={layer.path}
                                        className="lpc-preview-layer"
                                        style={{
                                            backgroundImage: `url(${SPRITE_BASE}${layer.path})`,
                                            filter: layer.hue !== undefined
                                                ? `hue-rotate(${layer.hue}deg) saturate(${layer.saturation ?? 1}) brightness(${layer.brightness ?? 1})`
                                                : undefined,
                                            ['--bg-y' as any]: `-${PREVIEW_ROW * 64}px`,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {focusedCategory && (
                            <div className="ac-sliders">
                                <h4>{focusedCategory} color</h4>
                                <label>
                                    Hue
                                    <input type="range" min={0} max={360} value={focusedLayer?.hue ?? 0}
                                        onChange={(e) => updateColor(focusedCategory, 'hue', Number(e.target.value))} />
                                </label>
                                <label>
                                    Saturation
                                    <input type="range" min={0} max={3} step={0.1} value={focusedLayer?.saturation ?? 1}
                                        onChange={(e) => updateColor(focusedCategory, 'saturation', Number(e.target.value))} />
                                </label>
                                <label>
                                    Brightness
                                    <input type="range" min={0.2} max={2} step={0.1} value={focusedLayer?.brightness ?? 1}
                                        onChange={(e) => updateColor(focusedCategory, 'brightness', Number(e.target.value))} />
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="ac-browser-panel">
                        <div className="ac-tabs">
                            <button className={activeTab === -1 ? 'active' : ''} onClick={() => setActiveTab(-1)}>Presets</button>
                            {TABS.map((tab, i) => (
                                <button key={tab.label} className={activeTab === i ? 'active' : ''} onClick={() => setActiveTab(i)}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="ac-grid">
                            {activeTab === -1 ? (
                                <div className="ac-preset-list">
                                    {PRESETS.map((preset) => (
                                        <button key={preset.name} className="ac-preset-btn" onClick={() => setLayers(preset.layers)}>
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                TABS[activeTab].categories.map((category) => (
                                    <CategorySwatches
                                        key={category}
                                        category={category}
                                        catalog={catalog}
                                        selected={layerByCategory[category]?.path}
                                        removable={!REQUIRED_CATEGORIES.includes(category)}
                                        onSelect={(path) => selectItem(category, path)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="ac-footer">
                    <button className="save-btn" onClick={handleSave}>Save Avatar</button>
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

function CategorySwatches({ category, catalog, selected, removable, onSelect }: {
    category: string; catalog: string[]; selected?: string; removable: boolean; onSelect: (path: string | null) => void;
}) {
    const items = catalog.filter((p) => categoryOf(p) === category);
    if (items.length === 0) return null;

    return (
        <div className="ac-category-group">
            <h5>{category}</h5>
            <div className="ac-swatch-row">
                {removable && (
                    <button
                        className={`ac-swatch ac-swatch-none${!selected ? ' selected' : ''}`}
                        onClick={() => onSelect(null)}
                    >
                        None
                    </button>
                )}
                {items.map((path) => (
                    <button
                        key={path}
                        className={`ac-swatch${selected === path ? ' selected' : ''}`}
                        style={{
                            backgroundImage: `url(${SPRITE_BASE}${path})`,
                            backgroundPosition: `0px -${PREVIEW_ROW * 64}px`,
                        }}
                        onClick={() => onSelect(path)}
                        title={path}
                    />
                ))}
            </div>
        </div>
    );
}

export default AvatarCustomizer;
