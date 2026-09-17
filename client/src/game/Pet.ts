import Phaser from 'phaser';
import { breedById, petIdleFrame, petSleepFrame, petAnimKey, petTextureKey, GROWTH_SCALE } from './petCatalog';
import type { PetDirection, PetGrowthStage } from './petCatalog';
import { ensurePetTextureLoaded, ensurePetWalkAnims } from './petLoader';

export class Pet extends Phaser.GameObjects.Container {
    private static readonly BASE_SIZE = 56;

    private shadow: Phaser.GameObjects.Ellipse;
    private nameText: Phaser.GameObjects.Text;
    private sprite?: Phaser.GameObjects.Sprite;
    // 'left' rather than 'down' — this pack's only clean, unambiguous pose
    // is the side profile (see petCatalog.ts's header), so that's the
    // correct default resting look, not an unused "away" row.
    private currentDirection: PetDirection = 'left';
    private breedId: string;
    private growthStage: PetGrowthStage;
    private sleeping = false;
    private generation = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, nickname: string, breedId: string, growthStage: PetGrowthStage, interactive: boolean = false) {
        super(scene, x, y);
        this.breedId = breedId;
        this.growthStage = growthStage;

        const size = Pet.BASE_SIZE * GROWTH_SCALE[growthStage];
        this.shadow = scene.add.ellipse(0, size * 0.42, size * 0.7, size * 0.24, 0x000000, 0.3);
        this.add(this.shadow);

        this.nameText = scene.add.text(0, -size * 0.75, nickname, {
            fontSize: '10px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 4, y: 1 },
        }).setOrigin(0.5, 0.5);
        this.add(this.nameText);

        this.loadSprite();
        scene.add.existing(this);

        // Only the owner's own pet should be clickable — other players' pets
        // must NOT be interactive, or they silently swallow right-clicks
        // aimed at your own pet whenever the two happen to overlap (very
        // likely, since idle/sleeping pets from every owner share the same
        // house position). Hit area sized for the adult (largest) scale so
        // it doesn't shrink away at earlier growth stages.
        if (interactive) {
            const hit = Pet.BASE_SIZE;
            this.setInteractive(new Phaser.Geom.Rectangle(-hit / 2, -hit * 0.9, hit, hit * 1.3), Phaser.Geom.Rectangle.Contains);
        }
    }

    private get breed() {
        return breedById(this.breedId);
    }

    private async loadSprite() {
        const gen = ++this.generation;
        const { species, colorIndex } = this.breed;
        const ok = await ensurePetTextureLoaded(this.scene, species);
        if (gen !== this.generation || !ok) return;

        const textureKey = petTextureKey(species);
        ensurePetWalkAnims(this.scene, species, colorIndex);

        const size = Pet.BASE_SIZE * GROWTH_SCALE[this.growthStage];
        this.sprite = this.scene.add.sprite(0, 0, textureKey, petIdleFrame(colorIndex, this.currentDirection));
        this.sprite.setDisplaySize(size, size);
        this.add(this.sprite);
        this.sendToBack(this.sprite);
        this.bringToTop(this.nameText);
        if (this.sleeping) this.applySleepFrame();
    }

    public playAnimation(direction: PetDirection) {
        this.currentDirection = direction;
        this.sleeping = false;
        if (!this.sprite) return;
        // The source art's side-profile row faces right natively — only
        // 'left' needs mirroring (see petCatalog.ts's file header).
        this.sprite.setFlipX(direction === 'left');
        const { species, colorIndex } = this.breed;
        const animKey = petAnimKey(species, colorIndex, direction);
        if (this.scene.anims.exists(animKey)) this.sprite.play(animKey, true);
    }

    public stopAnimation() {
        if (!this.sprite) return;
        this.sprite.stop();
        this.sprite.setFlipX(this.currentDirection === 'left');
        this.sprite.setFrame(petIdleFrame(this.breed.colorIndex, this.currentDirection));
    }

    public setSleeping(sleeping: boolean) {
        this.sleeping = sleeping;
        if (sleeping) this.applySleepFrame();
    }

    private applySleepFrame() {
        if (!this.sprite) return;
        this.sprite.stop();
        this.sprite.setFlipX(false);
        this.sprite.setFrame(petSleepFrame(this.breed.colorIndex));
    }

    public updateNickname(nickname: string) {
        this.nameText.setText(nickname);
    }

    public updateGrowthStage(stage: PetGrowthStage) {
        if (stage === this.growthStage) return;
        this.growthStage = stage;
        const size = Pet.BASE_SIZE * GROWTH_SCALE[stage];
        this.sprite?.setDisplaySize(size, size);
        this.shadow.setSize(size * 0.7, size * 0.24);
        this.nameText.setY(-size * 0.75);
    }

    public updateBreed(breedId: string) {
        if (breedId === this.breedId) return;
        this.breedId = breedId;
        this.sprite?.destroy();
        this.sprite = undefined;
        this.loadSprite();
    }
}
