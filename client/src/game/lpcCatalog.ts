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
    hue?: number; // 0-360
    saturation?: number; // 0-3
    brightness?: number; // 0.2-2
}

export interface Customization {
    version: 2;
    layers: CustomizationLayer[];
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
