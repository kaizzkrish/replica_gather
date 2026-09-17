// Pet sprite catalog. Art source: bluecarrot16's "[LPC] Cats and Dogs"
// (client/public/pet-assets/{dog,cat}.png), CC-BY 3.0 / GPL 3.0 / GPL 2.0 /
// OGA-BY 3.0 — https://opengameart.org/content/lpc-cats-and-dogs
// (see client/CREDITS.md for the full attribution text this license requires).
//
// Each sheet is 512x256: four 128x256 color blocks (one per breed color),
// each block a 4-col x 8-row grid of 32x32 frames (only rows 0-4 are used;
// 5-7 are blank). Row meaning, reverse-engineered from the art itself (the
// OGA page ships no layout doc) — confirmed by pixel inspection, not guessed:
//   row 0, cols 0-2: walking, facing RIGHT (3-frame cycle; head/snout is on
//     the right of the frame). col 3: lying/resting (eyes open).
//   row 1, cols 0-2: walking, facing away/up (true back view — no face
//     visible, just ears/back/tail — this is the correct pose for 'up').
//   row 3, cols 0-2: walking, facing right, alert-ears variant. col 3:
//     sleeping (curled, eyes closed).
// There is no dedicated front-facing ("down", toward the camera) art in
// this pack. Using the back view (row 1) for "down" would show the pet's
// rear while it's supposedly approaching the viewer — reads as walking
// backwards. Callers should instead keep showing the side profile (row 0,
// whichever of left/right it was last facing) for "down" movement; only
// 'up' actually uses row 1 here.

export const PET_FRAME_LAYOUT = {
    frameWidth: 32,
    frameHeight: 32,
    sheetCols: 16, // 512 / 32
    blockCols: 4,  // cols per color block (128 / 32)
} as const;

export const PET_WALK_ROW = { left: 0, up: 1 } as const;
export const PET_SLEEP_FRAME = { row: 3, col: 3 } as const;
export const PET_IDLE_COL = 1; // neutral mid-stride frame, used for both idle and as the walk cycle's middle frame

export type PetDirection = 'left' | 'right' | 'up' | 'down';
export type PetSpecies = 'dog' | 'cat';
export type PetMode = 'idle' | 'following' | 'sleeping';
export type PetGrowthStage = 'baby' | 'juvenile' | 'adult';

export const GROWTH_SCALE: Record<PetGrowthStage, number> = {
    baby: 0.6,
    juvenile: 0.8,
    adult: 1.0,
};

// Bond points required to advance out of each stage.
export const GROWTH_THRESHOLDS: Record<PetGrowthStage, number> = {
    baby: 50,
    juvenile: 150,
    adult: Infinity,
};

export function nextGrowthStage(stage: PetGrowthStage): PetGrowthStage {
    if (stage === 'baby') return 'juvenile';
    if (stage === 'juvenile') return 'adult';
    return 'adult';
}

export interface PetBreed {
    id: string;
    label: string;
    species: PetSpecies;
    colorIndex: number; // which 128px color block in the source sheet (0-3)
}

export const PET_BREEDS: PetBreed[] = [
    { id: 'shih_tzu', label: 'Shih Tzu', species: 'dog', colorIndex: 0 },
    { id: 'brown_dog', label: 'Brown Dog', species: 'dog', colorIndex: 1 },
    { id: 'golden_retriever', label: 'Golden Retriever', species: 'dog', colorIndex: 2 },
    { id: 'black_dog', label: 'Black Dog', species: 'dog', colorIndex: 3 },
    { id: 'white_cat', label: 'White Cat', species: 'cat', colorIndex: 0 },
    { id: 'golden_cat', label: 'Golden Cat', species: 'cat', colorIndex: 1 },
    { id: 'brown_tabby', label: 'Brown Tabby', species: 'cat', colorIndex: 2 },
    { id: 'black_cat', label: 'Black Cat', species: 'cat', colorIndex: 3 },
];

export function breedById(id: string): PetBreed {
    return PET_BREEDS.find((b) => b.id === id) || PET_BREEDS[0];
}

export function petTextureKey(species: PetSpecies): string {
    return `pet:${species}`;
}

export function petAnimKey(species: PetSpecies, colorIndex: number, direction: PetDirection): string {
    return `${petTextureKey(species)}::${colorIndex}::walk_${direction}`;
}

function frameIndex(colorIndex: number, row: number, col: number): number {
    const { sheetCols, blockCols } = PET_FRAME_LAYOUT;
    return row * sheetCols + colorIndex * blockCols + col;
}

// Only 'up' gets the dedicated back-view row — 'down' is handled by the
// caller (GameScene) reusing the side-profile 'left'/'right' animation, not
// by this function, since there's no toward-camera art to select here.
function rowFor(direction: PetDirection): number {
    return direction === 'up' ? PET_WALK_ROW.up : PET_WALK_ROW.left;
}

export function petIdleFrame(colorIndex: number, direction: PetDirection): number {
    return frameIndex(colorIndex, rowFor(direction), PET_IDLE_COL);
}

export function petSleepFrame(colorIndex: number): number {
    return frameIndex(colorIndex, PET_SLEEP_FRAME.row, PET_SLEEP_FRAME.col);
}

export function petWalkFrames(colorIndex: number, direction: PetDirection): number[] {
    return [0, 1, 2].map((col) => frameIndex(colorIndex, rowFor(direction), col));
}
