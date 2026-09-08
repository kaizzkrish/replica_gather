import Phaser from 'phaser';
import { LPC_FRAME_LAYOUT, animKeyFor, textureKeyFor } from './lpcCatalog';
import type { LpcDirection } from './lpcCatalog';

// Loads LPC layer spritesheets into Phaser on demand, one path at a time,
// instead of preloading all ~2,650 files in the pack up front.
//
// Every request is HEAD-checked before being handed to Phaser's loader.
// This matters because every host this app runs on (Netlify's `/*` redirect,
// nginx's `try_files ... /index.html`, Vite's own dev server) answers a
// request for a nonexistent file with 200 + index.html rather than a 404 —
// if that HTML ever reaches Phaser's loader as if it were a real PNG, the
// loader tries to decode it as an image and the whole load queue stalls,
// and the game never finishes booting. That's a confirmed, previously-hit
// bug in this project (see checkStyleAssets.ts, which this generalizes).

const BASE_URL = '/character-assets/spritesheets/';

const inFlight = new Map<string, Promise<boolean>>();

export function ensureLayerTextureLoaded(scene: Phaser.Scene, path: string): Promise<boolean> {
    const key = textureKeyFor(path);

    if (scene.textures.exists(key)) return Promise.resolve(true);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = loadLayerTexture(scene, path, key);
    inFlight.set(key, promise);
    promise.finally(() => inFlight.delete(key));
    return promise;
}

async function loadLayerTexture(scene: Phaser.Scene, path: string, key: string): Promise<boolean> {
    const url = BASE_URL + path;

    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) {
            return false;
        }
    } catch {
        return false;
    }

    return new Promise<boolean>((resolve) => {
        scene.load.spritesheet(key, url, {
            frameWidth: LPC_FRAME_LAYOUT.frameWidth,
            frameHeight: LPC_FRAME_LAYOUT.frameHeight,
        });

        scene.load.once(`filecomplete-spritesheet-${key}`, () => {
            // LPC sheets are genuine pixel art, not smooth illustration —
            // Phaser's default LINEAR filter blurs/smudges them when the
            // camera zooms in (each 64x64 frame can get magnified several
            // times over). NEAREST keeps every pixel a crisp square, which
            // is the correct look for this art style at any zoom level.
            scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
            resolve(true);
        });
        scene.load.once(`fileerror-spritesheet-${key}`, () => resolve(false));

        if (!scene.load.isLoading()) {
            scene.load.start();
        }
    });
}

export function ensureWalkAnimsForTexture(scene: Phaser.Scene, textureKey: string): void {
    LPC_FRAME_LAYOUT.directions.forEach((dir: LpcDirection, row: number) => {
        const key = animKeyFor(textureKey, dir);
        if (scene.anims.exists(key)) return;

        scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(textureKey, {
                start: row * LPC_FRAME_LAYOUT.cols + 1,
                end: row * LPC_FRAME_LAYOUT.cols + (LPC_FRAME_LAYOUT.cols - 1),
            }),
            frameRate: 10,
            repeat: -1,
        });
    });
}

export function idleFrameForDirection(direction: LpcDirection): number {
    const row = LPC_FRAME_LAYOUT.directions.indexOf(direction);
    return row * LPC_FRAME_LAYOUT.cols;
}
