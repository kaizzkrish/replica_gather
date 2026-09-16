import Phaser from 'phaser';
import { LPC_FRAME_LAYOUT, layerZIndex, textureKeyFor, animKeyFor, defaultCustomization, hasColorAdjustment } from './lpcCatalog';
import type { Customization, CustomizationLayer, LpcDirection } from './lpcCatalog';
import { ensureLayerTextureLoaded, ensureWalkAnimsForTexture, idleFrameForDirection } from './lpcLoader';

export type { Customization, CustomizationLayer } from './lpcCatalog';

export class Character extends Phaser.GameObjects.Container {
    // On-screen size (world units) every layer sprite is drawn at. LPC's
    // native 64x64 frame happens to match this exactly, so no scaling loss.
    private static readonly BODY_SIZE = 64;
    private static readonly BODY_Y = -10; // shifted up slightly for chair alignment

    private shadow: Phaser.GameObjects.Ellipse;
    private nameText: Phaser.GameObjects.Text;

    // One sprite per selected layer, keyed by its catalog path (bg/fg hair
    // sub-layers naturally get distinct keys since their paths differ).
    private layerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
    // The ColorMatrix FX controller for each sprite, keyed the same way —
    // created lazily on first color adjustment and reused across
    // updateCustomization() calls so recoloring never stacks duplicate
    // effects on the same sprite.
    private layerColorFx: Map<string, Phaser.FX.ColorMatrix> = new Map();
    private currentDirection: LpcDirection = 'down';

    // Bumped on every updateCustomization() call so async layer loads that
    // resolve after a newer call has superseded them can detect they're
    // stale and discard themselves instead of clobbering current state.
    private generation = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, name: string, customization: Customization) {
        super(scene, x, y);

        const { BODY_SIZE, BODY_Y } = Character;
        const halfBody = BODY_SIZE / 2;

        this.shadow = scene.add.ellipse(0, BODY_Y + halfBody + 1, BODY_SIZE * 0.56, BODY_SIZE * 0.19, 0x000000, 0.35);
        this.add(this.shadow);

        this.nameText = scene.add.text(0, BODY_Y - halfBody - 11, name, {
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 5, y: 1 },
        }).setOrigin(0.5, 0.5);
        this.add(this.nameText);

        this.updateCustomization(customization);

        scene.add.existing(this);

        // Hit area covering name text + body + shadow, so pointer events
        // (used for the right-click "Customize" menu) register anywhere
        // over the visible character, not just its (0,0) anchor point.
        this.setInteractive(new Phaser.Geom.Rectangle(-32, -53, 64, 76), Phaser.Geom.Rectangle.Contains);
    }

    public playAnimation(key: string) {
        if (!key) return;
        const dir = key.replace('walk_', '');
        if ((LPC_FRAME_LAYOUT.directions as readonly string[]).includes(dir)) {
            this.currentDirection = dir as LpcDirection;
        }

        this.layerSprites.forEach((sprite) => {
            const animKey = animKeyFor(sprite.texture.key, this.currentDirection);
            if (this.scene.anims.exists(animKey)) sprite.play(animKey, true);
        });
    }

    public stopAnimation() {
        const idleFrame = idleFrameForDirection(this.currentDirection);
        this.layerSprites.forEach((sprite) => {
            sprite.stop();
            sprite.setFrame(idleFrame);
        });
    }

    public updateCustomization(customization: Customization) {
        const gen = ++this.generation;
        // Data saved before the LPC layer system (a flat skinColor/hairStyle/
        // etc. shape, no `layers` array) has no 1:1 mapping onto real LPC
        // paths — rather than rendering nothing, fall back to the default
        // outfit so the character is at least visible.
        const newLayers = Array.isArray(customization?.layers)
            ? customization.layers
            : defaultCustomization().layers;
        const newPaths = new Set(newLayers.map((l) => l.path));

        // Drop sprites for layers no longer selected.
        for (const [path, sprite] of this.layerSprites) {
            if (!newPaths.has(path)) {
                sprite.destroy();
                this.layerSprites.delete(path);
                this.layerColorFx.delete(path);
            }
        }

        // Update existing layers in place; kick off async loads for new ones.
        newLayers.forEach((layer) => {
            const existing = this.layerSprites.get(layer.path);
            if (existing) {
                this.applyColor(existing, layer);
            } else {
                this.loadAndAddLayer(layer, gen);
            }
        });

        this.resortLayers();
    }

    private async loadAndAddLayer(layer: CustomizationLayer, gen: number) {
        const ok = await ensureLayerTextureLoaded(this.scene, layer.path);
        if (gen !== this.generation) return; // superseded by a newer updateCustomization() call
        if (!ok) {
            console.warn(`LPC layer failed to load: ${layer.path}`);
            return;
        }

        const key = textureKeyFor(layer.path);
        ensureWalkAnimsForTexture(this.scene, key);

        const sprite = this.scene.add.sprite(0, Character.BODY_Y, key, idleFrameForDirection(this.currentDirection));
        sprite.setDisplaySize(Character.BODY_SIZE, Character.BODY_SIZE);
        this.applyColor(sprite, layer);

        this.layerSprites.set(layer.path, sprite);
        this.add(sprite);
        this.resortLayers();
    }

    // True per-pixel recoloring via Phaser's built-in ColorMatrix FX
    // (WebGL-only), not setTint(). setTint() multiplies every pixel by one
    // flat target color, which flattens a garment's own baked-in shading/
    // highlights/folds into a single hue — this is what made e.g. brown
    // leather armor turn uniformly gray instead of a shaded version of the
    // picked color. ColorMatrix's .hue()/.saturate()/.brightness() apply
    // the same matrix transforms as CSS hue-rotate()/saturate()/
    // brightness() (verified against Phaser's source: .hue() uses the
    // identical W3C luminance-weighted rotation matrix), so each pixel
    // keeps its own relative shading — matching how the go-actor reference
    // project recolors (true CSS filters on its DOM-layered sprites).
    //
    // The FX controller is created once per sprite and reused on every
    // subsequent color update (re-adding would stack duplicate effects).
    // hue() is always called first with multiply=false, which resets the
    // matrix and applies the rotation in one step (rotation 0 collapses to
    // the identity matrix) — saturate()/brightness() then multiply on top
    // of that base, composing all three like a CSS filter chain.
    private applyColor(sprite: Phaser.GameObjects.Sprite, layer: CustomizationLayer) {
        if (!hasColorAdjustment(layer)) {
            const fx = this.layerColorFx.get(layer.path);
            if (fx) fx.active = false;
            return;
        }

        if (!sprite.preFX) return; // Canvas renderer fallback: no FX pipeline available

        let fx = this.layerColorFx.get(layer.path);
        if (!fx) {
            fx = sprite.preFX.addColorMatrix();
            this.layerColorFx.set(layer.path, fx);
        }
        fx.active = true;

        fx.hue(layer.hue ?? 0, false);
        if (layer.saturation !== undefined && layer.saturation !== 1) {
            fx.saturate(layer.saturation - 1, true);
        }
        if (layer.brightness !== undefined && layer.brightness !== 1) {
            fx.brightness(layer.brightness, true);
        }
    }

    // Recomputes stacking order and rebuilds the container's child list to
    // match (Phaser Containers render children in list order, not by
    // .depth) — cheap at the expected ~10-15 layers per character.
    private resortLayers() {
        const sortedSprites = [...this.layerSprites.entries()]
            .sort((a, b) => layerZIndex(a[0]) - layerZIndex(b[0]))
            .map(([, sprite]) => sprite);

        this.removeAll(false);
        this.add(this.shadow);
        this.add(sortedSprites);
        this.add(this.nameText);
    }

    public updateName(name: string) {
        this.nameText.setText(name);
    }

    public syncAlpha(alpha: number) {
        this.setAlpha(alpha);
    }
}
