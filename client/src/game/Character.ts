import Phaser from 'phaser';

export interface Customization {
    skinColor?: string;
    hairColor?: string;
    hairStyle?: string;
    outfitColor?: string;
    outfitId?: string;
    gender?: 'male' | 'female';
}

export class Character extends Phaser.GameObjects.Container {
    private bodySprite: Phaser.GameObjects.Sprite;
    private clothing: Phaser.GameObjects.Sprite;
    private hair: Phaser.GameObjects.Sprite;
    private nameText: Phaser.GameObjects.Text;
    private currentGender: 'male' | 'female' = 'male';
    private outfitKey: string = '';

    constructor(scene: Phaser.Scene, x: number, y: number, name: string, customization: Customization) {
        super(scene, x, y);
        this.currentGender = customization.gender === 'female' ? 'female' : 'male';
        const bodyTag = this.currentGender === 'female' ? 'charBase_female' : 'charBase';
        this.outfitKey = (customization as any).outfitKey || '';

        // 1. Base Body (The actual motion)
        this.bodySprite = scene.add.sprite(0, -10, bodyTag, 0); 
        this.bodySprite.setTint(0xffffff);
        this.bodySprite.setDisplaySize(54, 54); 
        this.bodySprite.setDepth(1);

        // 2. Clothing Overlay (The stylish part)
        this.clothing = scene.add.sprite(0, -10, this.outfitKey || 'charOutfit', 0);
        this.clothing.setDisplaySize(54, 54);
        this.clothing.setAlpha(this.outfitKey ? 1 : 0);
        this.clothing.setDepth(2);

        // 3. Hair Layer
        this.hair = scene.add.sprite(0, -10, 'charHair', 0);
        this.hair.setAlpha(0);
        this.hair.setDepth(3);

        // 4. Name Label
        this.nameText = scene.add.text(0, -48, name, {
            fontSize: '14px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 6, y: 3 },
            color: '#ffffff',
            align: 'center',
            fontFamily: 'Outfit, sans-serif'
        }).setOrigin(0.5).setDepth(10);

        this.add([this.bodySprite, this.clothing, this.hair, this.nameText]);
        scene.add.existing(this);
        
        // Initial anim
        this.playAnimation('down');
        this.stopAnimation();
    }

    public playAnimation(key: string) {
        if (!key) return;
        const prefix = this.currentGender === 'female' ? 'female_' : '';
        this.bodySprite.play(`${prefix}walk_${key}`, true);
        
        if (this.outfitKey) {
            this.clothing.play(`${this.outfitKey}_walk_${key}`, true);
        }
    }

    public stopAnimation() {
        this.bodySprite.anims.stop();
        if (this.outfitKey) this.clothing.anims.stop();
    }

    public updateCustomization(customization: Customization) {
        let redraw = false;
        
        if ((customization as any).outfitKey !== undefined && (customization as any).outfitKey !== this.outfitKey) {
            this.outfitKey = (customization as any).outfitKey;
            this.clothing.setTexture(this.outfitKey || 'charOutfit');
            this.clothing.setAlpha(this.outfitKey ? 1 : 0);
            redraw = true;
        }

        if (customization.gender && customization.gender !== this.currentGender) {
            this.currentGender = customization.gender;
            const texKey = customization.gender === 'female' ? 'charBase_female' : 'charBase';
            this.bodySprite.setTexture(texKey);
            redraw = true;
        }

        if (redraw) {
            if (this.bodySprite.anims.isPlaying) {
                const currentKey = this.bodySprite.anims.currentAnim?.key || '';
                const baseKey = currentKey.split('_walk_').pop() || 'down';
                this.playAnimation(baseKey);
            }
        }
        
        if (customization.skinColor) this.bodySprite.setTint(Phaser.Display.Color.HexStringToColor(customization.skinColor).color);
        if (customization.outfitColor) this.clothing.setTint(Phaser.Display.Color.HexStringToColor(customization.outfitColor).color);
    }

    public updateName(name: string) {
        this.nameText.setText(name);
    }

    public syncAlpha(alpha: number) {
        this.bodySprite.setAlpha(alpha);
        this.clothing.setAlpha(this.outfitKey ? alpha : 0);
        this.hair.setAlpha(0);
    }
}
