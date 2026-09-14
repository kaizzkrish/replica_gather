import React, { useState, useEffect, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import {
    layerZIndex, REQUIRED_CATEGORIES, categoryOf, defaultCustomization,
    CLOTHING_CATEGORIES, garmentKeyOf, bodyTypeOf, resolveGarmentFit, refitClothingLayers,
    cssFilterFor,
} from '../game/lpcCatalog';
import type { Customization, CustomizationLayer } from '../game/lpcCatalog';
import '../styles/avatarCustomizer.css';

interface AvatarCustomizerProps {
    socket: Socket | null;
    currUser: any;
    onClose: () => void;
    onSave: (customization: Customization) => void;
}

// Which top-level catalog folders show up under each tab.
const TABS: { label: string; categories: string[] }[] = [
    { label: 'Body', categories: ['body'] },
    { label: 'Face', categories: ['head', 'eyes', 'facial', 'beards'] },
    { label: 'Hair', categories: ['hair'] },
    { label: 'Top', categories: ['torso', 'arms', 'shoulders'] },
    { label: 'Bottom', categories: ['legs'] },
    { label: 'Shoes', categories: ['feet'] },
    { label: 'Accessories', categories: ['hat', 'neck', 'dress', 'shield'] },
];

// The pack's 'body/' folder also holds non-body-type items (tails, wings,
// wound overlays) that share the same top-level category as the actual
// body archetypes — filter the Body tab down to just body/bodies/*, and
// give each archetype a readable label (filenames alone aren't
// self-explanatory in a small thumbnail).
//
// The go-actor copy of this pack only shipped a walk.png for male/female/
// teen — muscular/child/pregnant were listed in its catalog but only had
// combat (hurt/slash) frames. Their walk.png files were pulled in directly
// from the upstream LiberatedPixelCup/Universal-LPC-Spritesheet-Character-
// Generator repo (same open-license family as the rest of the pack —
// CC0/CC-BY-SA/CC-BY/OGA-BY/GPL, verified per-asset in its own CREDITS.csv;
// track attribution before any public deployment, same as the rest of
// this pack).
const BODY_TYPE_LABELS: Record<string, string> = {
    'body/bodies/male/walk.png': 'Male',
    'body/bodies/female/walk.png': 'Female',
    'body/bodies/teen/walk.png': 'Teen',
    'body/bodies/muscular/walk.png': 'Muscular',
    'body/bodies/child/walk.png': 'Child',
    'body/bodies/pregnant/walk.png': 'Pregnant',
};

const PRESETS: { name: string; group: 'Male' | 'Female'; layers: CustomizationLayer[] }[] = [
    {
        name: 'Classic', group: 'Male', layers: [
            { category: 'body', path: 'body/bodies/teen/walk.png' }, // teen body fits this teen-cut torso correctly
            { category: 'head', path: 'head/heads/human/male/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/page/adult/walk.png' },
            { category: 'torso', path: 'torso/clothes/longsleeve/longsleeve2/teen/walk.png' },
            { category: 'legs', path: 'legs/pants2/thin/walk.png' },
            { category: 'feet', path: 'feet/shoes/basic/thin/walk.png' },
        ],
    },
    {
        name: 'Formal', group: 'Male', layers: [
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
        name: 'Sporty', group: 'Male', layers: [
            { category: 'body', path: 'body/bodies/male/walk.png' },
            { category: 'head', path: 'head/heads/human/male/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/bangslong/adult/walk.png' },
            { category: 'torso', path: 'torso/clothes/shortsleeve/shortsleeves/male/walk.png' },
            { category: 'legs', path: 'legs/pants/male/walk.png' },
            { category: 'feet', path: 'feet/shoes/ghillies/male/walk.png' },
        ],
    },
    {
        name: 'Casual', group: 'Female', layers: [
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
        name: 'Braided', group: 'Female', layers: [
            { category: 'body', path: 'body/bodies/female/walk.png' },
            { category: 'head', path: 'head/heads/human/female/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/braid/adult/bg/walk.png' },
            { category: 'hair', path: 'hair/braid/adult/fg/walk.png' },
            { category: 'torso', path: 'torso/clothes/longsleeve/longsleeve/female/walk.png' },
            { category: 'legs', path: 'legs/hose/thin/walk.png' },
            { category: 'feet', path: 'feet/boots/basic/thin/walk.png' },
        ],
    },
    {
        name: 'Bob Cut', group: 'Female', layers: [
            { category: 'body', path: 'body/bodies/female/walk.png' },
            { category: 'head', path: 'head/heads/human/female/walk.png' },
            { category: 'eyes', path: 'eyes/human/adult/default/walk.png' },
            { category: 'hair', path: 'hair/bob/adult/walk.png' },
            { category: 'torso', path: 'torso/clothes/longsleeve/longsleeve2/female/walk.png' },
            { category: 'legs', path: 'legs/formal/thin/walk.png' },
            { category: 'feet', path: 'feet/boots/revised/thin/walk.png' },
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
            const next = [...withoutCategory, {
                category, path,
                hue: existing?.hue, saturation: existing?.saturation, brightness: existing?.brightness,
            }];
            // Switching body type: re-fit every already-picked garment to the
            // new body so clothes don't stay mismatched (the sleeve-gap bug).
            return category === 'body' ? refitClothingLayers(next, bodyTypeOf(next), catalog) : next;
        });
        setFocusedCategory(category);
    };

    const updateColor = (category: string, field: 'hue' | 'saturation' | 'brightness', value: number) => {
        setLayers((prev) => prev.map((l) => (categoryOf(l.path) === category ? { ...l, [field]: value } : l)));
    };

    const resetColor = (category: string) => {
        setLayers((prev) => prev.map((l) => {
            if (categoryOf(l.path) !== category) return l;
            const { hue: _hue, saturation: _saturation, brightness: _brightness, ...rest } = l;
            return rest as CustomizationLayer;
        }));
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
                                {sortedForPreview.map((layer) => {
                                    // A real CSS filter — the exact same hue-rotate/
                                    // saturate/brightness operation Character.ts applies
                                    // in-game via Phaser's ColorMatrix FX, so this preview
                                    // and the actual rendered character match, and both
                                    // preserve the garment's own shading instead of
                                    // flattening it to one flat tint.
                                    const filter = cssFilterFor(layer);
                                    return (
                                        <div
                                            key={layer.path}
                                            className="lpc-preview-layer"
                                            style={{
                                                backgroundImage: `url(${SPRITE_BASE}${layer.path})`,
                                                filter: filter ?? undefined,
                                                ['--bg-y' as any]: `-${PREVIEW_ROW * 64}px`,
                                            }}
                                        />
                                    );
                                })}
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
                                    <input type="range" min={0} max={3} step={0.05} value={focusedLayer?.saturation ?? 1}
                                        onChange={(e) => updateColor(focusedCategory, 'saturation', Number(e.target.value))} />
                                </label>
                                <label>
                                    Brightness
                                    <input type="range" min={0} max={2} step={0.05} value={focusedLayer?.brightness ?? 1}
                                        onChange={(e) => updateColor(focusedCategory, 'brightness', Number(e.target.value))} />
                                </label>
                                <button className="ac-reset-color-btn" onClick={() => resetColor(focusedCategory)}>
                                    Reset Color
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="ac-browser-panel">
                        <div className="ac-tabs">
                            <button className={activeTab === -1 ? 'active' : ''} onClick={() => setActiveTab(-1)}>Presets</button>
                            {TABS.map((tab, i) => (
                                <button
                                    key={tab.label}
                                    className={activeTab === i ? 'active' : ''}
                                    onClick={() => {
                                        setActiveTab(i);
                                        // Auto-focus whichever category in this tab is
                                        // already selected, so the color sliders show up
                                        // immediately — otherwise they stay hidden until
                                        // the user re-clicks an already-selected swatch,
                                        // which looks like color changes are being ignored.
                                        const alreadySelected = tab.categories.find((c) => layerByCategory[c]);
                                        setFocusedCategory(alreadySelected ?? null);
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="ac-grid">
                            {activeTab === -1 ? (
                                <>
                                    {(['Male', 'Female'] as const).map((group) => (
                                        <div className="ac-category-group" key={group}>
                                            <h5>{group}</h5>
                                            <div className="ac-preset-list">
                                                {PRESETS.filter((p) => p.group === group).map((preset) => (
                                                    <button key={preset.name} className="ac-preset-btn" onClick={() => setLayers(preset.layers)}>
                                                        {preset.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                TABS[activeTab].categories.map((category) => (
                                    <CategorySwatches
                                        key={category}
                                        category={category}
                                        catalog={catalog}
                                        selected={layerByCategory[category]?.path}
                                        removable={!REQUIRED_CATEGORIES.includes(category)}
                                        bodyType={bodyTypeOf(layers)}
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

function CategorySwatches({ category, catalog, selected, removable, bodyType, onSelect }: {
    category: string; catalog: string[]; selected?: string; removable: boolean; bodyType: string; onSelect: (path: string | null) => void;
}) {
    // The 'body' folder also holds non-body-type items (tails, wings, wound
    // overlays) under the same top-level category — restrict to the actual
    // body archetypes for this one category.
    const prefix = category === 'body' ? 'body/bodies/' : `${category}/`;
    const rawItems = catalog.filter((p) => p.startsWith(prefix));
    if (rawItems.length === 0) return null;

    // Clothing categories offer one swatch per garment (not per fit
    // variant) — the exact file used is whichever fit matches the current
    // body type, resolved via resolveGarmentFit. This is what makes a
    // selected garment automatically re-fit when the body type changes,
    // instead of leaving the player on a mismatched male/teen/etc. cut.
    const isClothing = CLOTHING_CATEGORIES.includes(category);
    const items = isClothing
        ? [...new Set(rawItems.map((p) => garmentKeyOf(p)))]
            .map((garmentKey) => resolveGarmentFit(garmentKey, bodyType, catalog))
            .filter((p): p is string => !!p)
        : rawItems;

    return (
        <div className="ac-category-group">
            <h5>{category === 'body' ? 'Body Type' : category}</h5>
            <div className="ac-swatch-row">
                {removable && (
                    <button
                        className={`ac-swatch ac-swatch-none${!selected ? ' selected' : ''}`}
                        onClick={() => onSelect(null)}
                    >
                        None
                    </button>
                )}
                {items.map((path) => {
                    // For clothing, "selected" is a specific fit's path, but the
                    // garment itself might be selected under a different fit
                    // (e.g. picked while on a male body, now viewing as female) —
                    // compare by garment identity, not exact path, so the
                    // checkmark still shows on the right swatch after a refit.
                    const isSelected = isClothing
                        ? !!selected && garmentKeyOf(selected) === garmentKeyOf(path)
                        : selected === path;
                    return (
                        <div className="ac-swatch-item" key={path}>
                            <button
                                className={`ac-swatch${isSelected ? ' selected' : ''}`}
                                style={{
                                    backgroundImage: `url(${SPRITE_BASE}${path})`,
                                    backgroundPosition: `0px -${PREVIEW_ROW * 64}px`,
                                }}
                                onClick={() => onSelect(path)}
                                title={BODY_TYPE_LABELS[path] ?? path}
                            />
                            {BODY_TYPE_LABELS[path] && <span className="ac-swatch-label">{BODY_TYPE_LABELS[path]}</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AvatarCustomizer;
