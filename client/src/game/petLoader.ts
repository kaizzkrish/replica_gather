import Phaser from 'phaser';
import { PET_FRAME_LAYOUT, petTextureKey, petAnimKey, petWalkFrames } from './petCatalog';
import type { PetDirection, PetSpecies } from './petCatalog';

const BASE_URL = '/pet-assets/';
const DIRECTIONS: PetDirection[] = ['left', 'right', 'up', 'down'];

const inFlight = new Map<string, Promise<boolean>>();

export function ensurePetTextureLoaded(scene: Phaser.Scene, species: PetSpecies): Promise<boolean> {
    const key = petTextureKey(species);
    if (scene.textures.exists(key)) return Promise.resolve(true);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = loadPetTexture(scene, species, key);
    inFlight.set(key, promise);
    promise.finally(() => inFlight.delete(key));
    return promise;
}

function loadPetTexture(scene: Phaser.Scene, species: PetSpecies, key: string): Promise<boolean> {
    const url = `${BASE_URL}${species}.png`;

    return new Promise<boolean>((resolve) => {
        scene.load.spritesheet(key, url, {
            frameWidth: PET_FRAME_LAYOUT.frameWidth,
            frameHeight: PET_FRAME_LAYOUT.frameHeight,
        });

        scene.load.once(`filecomplete-spritesheet-${key}`, () => {
            scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
            resolve(true);
        });
        scene.load.once(`fileerror-spritesheet-${key}`, () => resolve(false));

        if (!scene.load.isLoading()) scene.load.start();
    });
}

// One 3-frame walk cycle per direction, per breed color. 'right' reuses the
// 'left' frames — Pet.ts flips the sprite horizontally rather than doubling
// the animation set. 'down' reuses the 'up' frames (see petCatalog.ts's file
// header for why: this pack has no front-facing art).
export function ensurePetWalkAnims(scene: Phaser.Scene, species: PetSpecies, colorIndex: number): void {
    const textureKey = petTextureKey(species);
    DIRECTIONS.forEach((dir) => {
        const key = petAnimKey(species, colorIndex, dir);
        if (scene.anims.exists(key)) return;

        scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(textureKey, { frames: petWalkFrames(colorIndex, dir) }),
            frameRate: 6,
            repeat: -1,
        });
    });
}
