// Shared constants for the LPC (Liberated Pixel Cup) layered character system.
// Used by both the Phaser rendering code (Character.ts, lpcLoader.ts) and the
// React customizer UI, so the two stay in sync.
//
// Asset pack: client/public/character-assets/ — copied from the LPC pack
// used in the go-actor/ms5 reference project. Every `walk.png` is a 576x256
// spritesheet: 9 columns x 4 rows of 64x64 frames. Row order is the LPC
// standard [up, left, down, right]; column 0 of each row is the idle/standing
// pose, columns 1-8 are the 8-frame walk cycle.

export const LPC_FRAME_LAYOUT = {
    frameWidth: 64,
    frameHeight: 64,
    cols: 9,
    rows: 4,
    directions: ['up', 'left', 'down', 'right'] as const,
} as const;

export type LpcDirection = (typeof LPC_FRAME_LAYOUT.directions)[number];

export interface CustomizationLayer {
    category: string;
    path: string; // catalog-relative path, e.g. 'hair/curly_long/adult/walk.png'
    // These three mirror CSS filter semantics exactly (hue-rotate/saturate/
    // brightness) — they're multipliers/rotations applied to the garment's
    // OWN existing pixel colors, not an absolute target color. This is what
    // lets a shaded/highlighted garment keep its shading after recoloring,
    // unlike a flat setTint(). Rendered via Phaser's ColorMatrix FX in
    // Character.ts, and via the real CSS `filter` property in
    // AvatarCustomizer.tsx's preview — cssFilterFor() below is the single
    // source of truth both use.
    hue?: number; // degrees of hue rotation, 0-360. 0/undefined = no rotation.
    saturation?: number; // multiplier, e.g. 0 = grayscale, 1 = unchanged, 2.5 = very saturated.
    brightness?: number; // multiplier, e.g. 0 = black, 1 = unchanged, 1.2 = brighter.
}

export interface Customization {
    version: 2;
    layers: CustomizationLayer[];
}

// True if the player has touched ANY of hue/saturation/brightness for this
// layer — not just hue. A slider interaction that only ever moves
// Saturation (e.g. dragging it to 0 to desaturate toward grey, without
// touching Hue at all) must still count as a real color adjustment, or it
// silently gets ignored.
export function hasColorAdjustment(layer: CustomizationLayer): boolean {
    return layer.hue !== undefined || layer.saturation !== undefined || layer.brightness !== undefined;
}

// Builds the CSS `filter` value for a layer's color adjustment, or null if
// none is set. This is the exact same operation Character.ts performs via
// Phaser's ColorMatrix FX (hue() is a byte-for-byte port of the W3C
// hue-rotate() matrix; brightness() matches CSS brightness() exactly) —
// so the React preview and the actual in-game render use two different
// engines but the same underlying math, and stay visually identical.
export function cssFilterFor(layer: CustomizationLayer): string | null {
    if (!hasColorAdjustment(layer)) return null;
    const parts: string[] = [];
    if (layer.hue) parts.push(`hue-rotate(${layer.hue}deg)`);
    if (layer.saturation !== undefined && layer.saturation !== 1) parts.push(`saturate(${layer.saturation})`);
    if (layer.brightness !== undefined && layer.brightness !== 1) parts.push(`brightness(${layer.brightness})`);
    return parts.length ? parts.join(' ') : null;
}

// Path-prefix -> stacking order. Higher renders on top. Ported from the
// reference project's getLayerZIndex(). bg/fg path segments (used by some
// hairstyles/braids that need to render both behind and in front of the
// head) are special-cased on top of their category's base z-index.
const CATEGORY_Z_BASE: Record<string, number> = {
    body: 2,
    eyes: 3,
    head: 4,
    facial: 5,
    beards: 6,
    legs: 9,
    feet: 8,
    torso: 11,
    arms: 12,
    shoulders: 13,
    hair: 14,
    neck: 15,
    hat: 16,
    dress: 17,
    shield: 18,
};

export function categoryOf(path: string): string {
    return path.split('/')[0];
}

export function layerZIndex(path: string): number {
    const category = categoryOf(path);
    let z = CATEGORY_Z_BASE[category] ?? 10;
    // bg sub-layers render just behind their category's usual slot, fg just in front.
    if (path.includes('/bg/')) z -= 0.5;
    else if (path.includes('/fg/')) z += 0.5;
    return z;
}

// Categories that must always have at least one layer selected — the
// customizer UI should not offer "None" for these.
export const REQUIRED_CATEGORIES = ['body', 'head', 'torso', 'legs', 'feet'];

export function textureKeyFor(path: string): string {
    return `lpc:${path}`;
}

export function animKeyFor(textureKey: string, direction: LpcDirection): string {
    return `${textureKey}::walk_${direction}`;
}

const DEFAULT_LAYER_PATHS = [
    // 'teen' body — matches the teen-fitted longsleeve2 torso below. Pairing
    // that torso with the bulkier 'male' body left visible skin gaps at the
    // shoulders where the sleeve didn't reach.
    'body/bodies/teen/walk.png',
    'head/heads/human/male/walk.png',
    'eyes/human/adult/default/walk.png',
    'hair/page/adult/walk.png',
    'torso/clothes/longsleeve/longsleeve2/teen/walk.png',
    'legs/pants2/thin/walk.png',
    'feet/shoes/basic/thin/walk.png',
];

export function defaultCustomization(): Customization {
    return {
        version: 2,
        layers: DEFAULT_LAYER_PATHS.map((path) => ({ category: categoryOf(path), path })),
    };
}

// --- Clothing fit resolution ---------------------------------------------
//
// Worn items (torso/legs/feet/arms/shoulders) come in body-shaped variants
// — but the pack isn't consistent about which variants exist per garment
// (some have male/female/teen, others only male/thin, etc — see notes in
// AvatarCustomizer.tsx). Rather than making the player manually pick a
// separate catalog entry per fit and risk a mismatched gap at the
// shoulders (the original "shirt doesn't fit" bug), garments are browsed
// by name and the correct fit for the currently-selected body is resolved
// automatically — including re-resolving already-picked garments when the
// player switches body type.

const FIT_TOKENS = ['male', 'female', 'teen', 'thin', 'muscular', 'child', 'pregnant'];

export const CLOTHING_CATEGORIES = ['torso', 'legs', 'feet', 'arms', 'shoulders'];

// Preference order to try when resolving a garment for a given body type —
// first match that actually exists in the catalog wins. Clothing items in
// this pack essentially never have muscular/child/pregnant-specific fits,
// so those three fall through to the closest reasonable stand-in.
const FIT_PREFERENCE: Record<string, string[]> = {
    male: ['male', 'thin', 'female', 'teen'],
    female: ['female', 'thin', 'teen', 'male'],
    teen: ['teen', 'thin', 'female', 'male'],
    muscular: ['male', 'thin', 'female', 'teen'],
    child: ['teen', 'thin', 'female', 'male'],
    pregnant: ['female', 'thin', 'teen', 'male'],
};

export function fitOf(path: string): string | null {
    const parts = path.split('/');
    const candidate = parts[parts.length - 2];
    return FIT_TOKENS.includes(candidate) ? candidate : null;
}

// The garment's identity with its fit segment stripped, e.g.
// 'torso/clothes/longsleeve/longsleeve2/teen/walk.png' -> 'torso/clothes/longsleeve/longsleeve2'.
// Items with no fit segment (a single universal variant) return the path
// unchanged minus '/walk.png', so they still group into their own single-item "garment".
export function garmentKeyOf(path: string): string {
    const fit = fitOf(path);
    const parts = path.split('/');
    return fit ? parts.slice(0, -2).join('/') : parts.slice(0, -1).join('/');
}

export function bodyTypeOf(layers: CustomizationLayer[]): string {
    const body = layers.find((l) => categoryOf(l.path) === 'body');
    const match = body?.path.match(/body\/bodies\/(\w+)\/walk\.png/);
    return match ? match[1] : 'male';
}

// Finds the best available catalog entry for a garment given a body type,
// falling back through FIT_PREFERENCE, then to any variant that exists at
// all (covers garments whose only variant doesn't match the body's own
// fit token, e.g. a male-only item kept on a female body rather than
// disappearing).
export function resolveGarmentFit(garmentKey: string, bodyType: string, catalog: string[]): string | undefined {
    const preference = FIT_PREFERENCE[bodyType] ?? FIT_PREFERENCE.male;
    for (const fit of preference) {
        const candidate = `${garmentKey}/${fit}/walk.png`;
        if (catalog.includes(candidate)) return candidate;
    }
    return catalog.find((p) => p.startsWith(`${garmentKey}/`));
}

// Re-resolves every clothing layer's fit to match a (newly-selected) body
// type — so garments the player already picked follow along instead of
// staying mismatched to the old body.
export function refitClothingLayers(layers: CustomizationLayer[], bodyType: string, catalog: string[]): CustomizationLayer[] {
    return layers.map((layer) => {
        if (!CLOTHING_CATEGORIES.includes(categoryOf(layer.path))) return layer;
        const resolved = resolveGarmentFit(garmentKeyOf(layer.path), bodyType, catalog);
        return resolved && resolved !== layer.path ? { ...layer, path: resolved } : layer;
    });
}
