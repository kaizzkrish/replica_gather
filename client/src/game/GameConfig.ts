import Phaser from 'phaser';

// The logical viewport GameScene's camera/zoom math is written against
// (VIEWPORT_WIDTH/HEIGHT there). Keep in sync with GameScene.ts.
export const BASE_WIDTH = 800;
export const BASE_HEIGHT = 600;

// Phaser's ENVELOP scale mode renders into a canvas whose backing store is
// exactly `width`x`height` from config, then CSS-stretches that canvas to
// cover the parent element (#game-container, 100vw x 100vh) — regardless of
// how much bigger the parent is. With a fixed 800x600 backing store that's a
// 2-3x+ upscale on any normal desktop window (more on Retina/high-DPI
// screens), which is exactly what shows up as blurry/pixelated characters.
//
// This computes a backing-store size that matches what the browser will
// actually display it at (the same cover-fit Phaser itself performs) times
// devicePixelRatio, so the canvas is never upscaled beyond its native
// resolution. GameScene compensates with a matching baseline camera zoom
// (see `setZoom`) so this is purely a resolution change — world-units-per-
// screen-pixel, camera bounds, and gameplay framing are all unaffected.
export function computeGameSize(): { width: number; height: number } {
    const dpr = window.devicePixelRatio || 1;
    const coverFactor = Math.max(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT);
    return {
        width: Math.round(BASE_WIDTH * coverFactor * dpr),
        height: Math.round(BASE_HEIGHT * coverFactor * dpr),
    };
}

export function createGameConfig(): Phaser.Types.Core.GameConfig {
    const { width, height } = computeGameSize();

    return {
        type: Phaser.AUTO,
        width,
        height,
        scale: {
            mode: Phaser.Scale.ENVELOP,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: 'game-container'
        },
        render: {
            antialias: true,
            roundPixels: true
        },
        // Right-clicking the character opens a custom "Customize" menu (see
        // GameScene's player 'pointerdown' handler) — suppress the browser's
        // native context menu over the canvas so it doesn't appear alongside it.
        disableContextMenu: true,
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { x: 0, y: 0 },
                debug: false
            }
        },
        scene: [],
        parent: 'game-container',
        backgroundColor: '#f5f5dc'
    };
}
