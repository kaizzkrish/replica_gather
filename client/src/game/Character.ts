import Phaser from 'phaser';

export interface Customization {
    skinColor: string;
    hairColor: string;
    hairStyle: string;
    outfitColor: string;
    outfitId: string;
}

export class Character extends Phaser.GameObjects.Container {
    private bodySprite: Phaser.GameObjects.Sprite;
    private clothing: Phaser.GameObjects.Sprite;
    private hair: Phaser.GameObjects.Sprite;
    private nameText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, name: string, customization: Customization) {
        super(scene, x, y);

        // 1. Base Body Layer
        this.bodySprite = scene.add.sprite(0, 0, 'charBase', 0);
        this.bodySprite.setTint(Phaser.Display.Color.HexStringToColor(customization.skinColor).color);
        this.bodySprite.setDisplaySize(64, 64);
        this.bodySprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.bodySprite.setDepth(1);

        // 2. Clothing Layer
        this.clothing = scene.add.sprite(0, 0, 'charOutfit', 0);
        this.clothing.setTint(Phaser.Display.Color.HexStringToColor(customization.outfitColor).color);
        this.clothing.setDisplaySize(64, 64);
        this.clothing.setBlendMode(Phaser.BlendModes.SCREEN);
        this.clothing.setDepth(2);

        // 3. Hair Layer
        this.hair = scene.add.sprite(0, -8, 'charHair', 0);
        this.hair.setTint(Phaser.Display.Color.HexStringToColor(customization.hairColor).color);
        this.hair.setDisplaySize(64, 64);
        this.hair.setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.hair.setDepth(3);

        // 4. Name Label
        this.nameText = scene.add.text(0, -45, name, {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5);
        this.nameText.setDepth(4);

        // Add all to container
        this.add([this.bodySprite, this.clothing, this.hair, this.nameText]);

        scene.add.existing(this);
    }

    public playAnimation(key: string) {
        if (!key) return;
        this.bodySprite.play(key, true);
        this.clothing.play(`outfit_${key}`, true);
        this.hair.play(`hair_${key}`, true);
    }

    public stopAnimation() {
        this.bodySprite.stop();
        this.clothing.stop();
        this.hair.stop();
    }

    public updateCustomization(customization: Customization) {
        if (customization.skinColor) this.bodySprite.setTint(Phaser.Display.Color.HexStringToColor(customization.skinColor).color);
        if (customization.outfitColor) this.clothing.setTint(Phaser.Display.Color.HexStringToColor(customization.outfitColor).color);
        if (customization.hairColor) this.hair.setTint(Phaser.Display.Color.HexStringToColor(customization.hairColor).color);
    }

    public updateName(name: string) {
        this.nameText.setText(name);
    }

    public syncAlpha(alpha: number) {
        this.setAlpha(alpha);
    }
}
