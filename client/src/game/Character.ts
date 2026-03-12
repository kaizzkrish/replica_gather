import Phaser from 'phaser';

export interface Customization {
    skinColor: string;
    hairColor: string;
    hairStyle: string;
    outfitColor: string;
    outfitId: string;
    gender: 'male' | 'female';
}

export class Character extends Phaser.GameObjects.Container {
    private bodySprite: Phaser.GameObjects.Sprite;
    private clothing: Phaser.GameObjects.Sprite;
    private hair: Phaser.GameObjects.Sprite;
    private nameText: Phaser.GameObjects.Text;
    private currentGender: 'male' | 'female' = 'male';

    constructor(scene: Phaser.Scene, x: number, y: number, name: string, customization: Customization) {
        super(scene, x, y);

        // 1. Base Body Layer (Now our full "Proper" character)
        this.bodySprite = scene.add.sprite(0, 0, 'charBase', 0);
        this.bodySprite.setTint(0xffffff); // No tint, use original colors
        this.bodySprite.setDisplaySize(64, 64); // Sized to fit game tiles
        this.bodySprite.setBlendMode(Phaser.BlendModes.NORMAL);
        this.bodySprite.setDepth(1);

        // 2. Clothing Layer (Hidden for now until we have proper matching layers)
        this.clothing = scene.add.sprite(0, 0, 'charOutfit', 0);
        this.clothing.setAlpha(0);
        this.clothing.setDepth(2);

        // 3. Hair Layer (Hidden for now)
        this.hair = scene.add.sprite(0, 0, 'charHair', 0);
        this.hair.setAlpha(0);
        this.hair.setDepth(3);

        // 4. Name Label
        this.nameText = scene.add.text(0, -45, name, {
            fontSize: '14px',
            color: '#3e2723',
            backgroundColor: '#fff8e1aa',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5);
        this.nameText.setDepth(4);

        // Add all to container
        this.add([this.bodySprite, this.clothing, this.hair, this.nameText]);

        // Apply initial customization
        this.updateCustomization(customization);

        scene.add.existing(this);
    }

    public playAnimation(key: string) {
        if (!key) return;
        const animKey = this.currentGender === 'female' ? `female_${key}` : key;
        this.bodySprite.play(animKey, true);
        // this.clothing.play(`outfit_${key}`, true);
        // this.hair.play(`hair_${key}`, true);
    }

    public stopAnimation() {
        this.bodySprite.stop();
        // this.clothing.stop();
        // this.hair.stop();
    }

    public updateCustomization(customization: Customization) {
        if (customization.gender) {
            this.currentGender = customization.gender;
            const texKey = customization.gender === 'female' ? 'charBase_female' : 'charBase';
            this.bodySprite.setTexture(texKey);
        }
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
