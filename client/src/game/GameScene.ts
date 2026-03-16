import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { Character, type Customization } from './Character';

export default class GameScene extends Phaser.Scene {
    private player?: Character;
    private otherPlayers: Map<string, Character> = new Map();
    private socket?: Socket;
    private userData?: any;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private lastMoveTime = 0;
    private moveInterval = 150; // Faster movement for smooth animations
    private tileSize = 40;

    constructor() {
        super('GameScene');
    }

    init(data: { socket: Socket, user: any }) {
        this.socket = data.socket;
        this.userData = data.user;
    }

    preload() {
        // Load Base Body
        this.load.spritesheet('charBase', '/charBase.png?v=fixed', {
            frameWidth: 160, frameHeight: 160
        });
        this.load.spritesheet('charBase_female', '/charBase_female.png', {
            frameWidth: 160, frameHeight: 160
        });

        // Load Clothing
        this.load.spritesheet('charOutfit', '/transparent.png', {
            frameWidth: 160, frameHeight: 160
        });

        // Load Hair
        this.load.spritesheet('charHair', '/transparent.png', {
            frameWidth: 160, frameHeight: 160
        });

        this.load.on('loaderror', (file: any) => {
            console.error('❌ Error loading asset:', file.src);
        });

        this.load.on('complete', () => {
            console.log('✅ All assets loaded successfully');
        });
    }

    create() {
        if (!this.socket) return;

        // Create Animations
        const baseTextures = ['charBase', 'charBase_female'];
        const directions = ['down', 'left', 'right', 'up'];

        baseTextures.forEach(tex => {
            const prefix = tex === 'charBase' ? '' : 'female_';
            directions.forEach((dir, index) => {
                // Body
                this.anims.create({
                    key: `${prefix}walk_${dir}`,
                    frames: this.anims.generateFrameNumbers(tex, { start: index * 4, end: index * 4 + 3 }),
                    frameRate: 10,
                    repeat: -1
                });
            });
        });

        // Outfit/Hair (Global for now)
        directions.forEach((dir, index) => {
            // Outfit
            this.anims.create({
                key: `outfit_walk_${dir}`,
                frames: this.anims.generateFrameNumbers('charOutfit', { start: index * 4, end: index * 4 + 3 }),
                frameRate: 10,
                repeat: -1
            });
            // Hair
            this.anims.create({
                key: `hair_walk_${dir}`,
                frames: this.anims.generateFrameNumbers('charHair', { start: index * 4, end: index * 4 + 3 }),
                frameRate: 10,
                repeat: -1
            });
        });

        // Background / Grid
        this.add.rectangle(400, 300, 800, 600, 0xece0d1).setDepth(-100);
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x8d6e63, 0.2);
        for (let i = 0; i < 800; i += 40) { graphics.moveTo(i, 0); graphics.lineTo(i, 600); }
        for (let j = 0; j < 600; j += 40) { graphics.moveTo(0, j); graphics.lineTo(800, j); }
        graphics.strokePath().setDepth(-5);

        // Listeners
        this.socket.on('currentPlayers', (players: any) => {
            console.log('👥 Current Players received:', Object.keys(players).length, players);
            Object.keys(players).forEach((id) => {
                if (id === this.socket?.id) this.addPlayer(players[id]);
                else this.addOtherPlayers(players[id]);
            });
        });

        this.socket.on('newPlayer', (playerInfo: any) => this.addOtherPlayers(playerInfo));

        this.socket.on('profileUpdated', (pInfo: any) => {
            if (pInfo.id === this.socket?.id) {
                this.player?.updateCustomization(pInfo.customization);
            } else {
                const char = this.otherPlayers.get(pInfo.id);
                if (char) char.updateCustomization(pInfo.customization);
            }
        });

        this.socket.on('playerMoved', (pInfo: any) => {
            const char = this.otherPlayers.get(pInfo.id);
            if (char) {
                this.tweens.add({
                    targets: char,
                    x: pInfo.x,
                    y: pInfo.y,
                    duration: 150,
                    ease: 'Power2'
                });
                if (pInfo.animationKey) {
                    char.playAnimation(pInfo.animationKey);
                } else {
                    char.stopAnimation();
                }
            }
        });

        this.socket.on('playerDisconnected', (id: string) => {
            const char = this.otherPlayers.get(id);
            if (char) {
                char.destroy();
                this.otherPlayers.delete(id);
            }
        });

        const joinRoom = () => {
            this.socket?.emit('joinRoom', {
                room: 'main-space',
                name: this.userData?.name || 'Explorer',
                userId: this.userData?.sub,
                customization: this.userData?.customization
            });
        };

        if (this.socket.connected) joinRoom();
        this.socket.on('connect', joinRoom);

        this.cursors = this.input.keyboard?.createCursorKeys();
    }

    update() {
        if (this.player && this.cursors) {
            const currentTime = this.time.now;

            if (currentTime - this.lastMoveTime > this.moveInterval) {
                let moved = false;
                let newX = this.player.x;
                let newY = this.player.y;
                let animKey = '';

                if (this.cursors.left.isDown) {
                    newX -= this.tileSize;
                    animKey = 'walk_left';
                    moved = true;
                } else if (this.cursors.right.isDown) {
                    newX += this.tileSize;
                    animKey = 'walk_right';
                    moved = true;
                } else if (this.cursors.up.isDown) {
                    newY -= this.tileSize;
                    animKey = 'walk_up';
                    moved = true;
                } else if (this.cursors.down.isDown) {
                    newY += this.tileSize;
                    animKey = 'walk_down';
                    moved = true;
                }

                if (moved) {
                    newX = Phaser.Math.Clamp(newX, 20, 780);
                    newY = Phaser.Math.Clamp(newY, 20, 580);

                    if (newX !== this.player.x || newY !== this.player.y) {
                        this.lastMoveTime = currentTime;
                        this.tweens.add({
                            targets: this.player,
                            x: newX,
                            y: newY,
                            duration: 120,
                            ease: 'Power2'
                        });
                        this.player.playAnimation(animKey);
                        this.socket?.emit('playerMovement', { x: newX, y: newY, animationKey: animKey });
                    }
                } else {
                    this.player.stopAnimation();
                    this.socket?.emit('playerMovement', { x: this.player.x, y: this.player.y, animationKey: '' });
                }
            }

            // Proximity Logic
            const nearbyPlayerIds: string[] = [];
            this.otherPlayers.forEach((char, id) => {
                const distance = Phaser.Math.Distance.Between(this.player!.x, this.player!.y, char.x, char.y);
                if (distance < 81) {
                    char.syncAlpha(1);
                    nearbyPlayerIds.push(id);
                } else {
                    char.syncAlpha(0.2);
                }
            });

            // Dispatch event for Chat
            const eventPayload = JSON.stringify(nearbyPlayerIds);
            if ((this as any).lastNearbyPayload !== eventPayload) {
                (this as any).lastNearbyPayload = eventPayload;
                window.dispatchEvent(new CustomEvent('nearby-players-change', {
                    detail: {
                        playerIds: nearbyPlayerIds,
                        playerNames: nearbyPlayerIds.map(id => this.otherPlayers.get(id)?.name || 'Unknown')
                    }
                }));
            }
        }
    }

    addPlayer(playerInfo: any) {
        const custom: Customization = playerInfo.customization || {
            skinColor: '#ffdbac',
            hairColor: '#4b2c20',
            hairStyle: 'default',
            outfitColor: '#646cff',
            outfitId: 'basic',
            gender: 'male'
        };
        const x = isNaN(Number(playerInfo.x)) ? 400 : Number(playerInfo.x);
        const y = isNaN(Number(playerInfo.y)) ? 300 : Number(playerInfo.y);
        
        console.log(`👤 Adding player: ${playerInfo.name} at (${x}, ${y})`);
        this.player = new Character(this, x, y, playerInfo.name, custom);
        this.player.setDepth(10);
    }

    addOtherPlayers(playerInfo: any) {
        if (this.otherPlayers.has(playerInfo.id)) return;

        const custom: Customization = playerInfo.customization || {
            skinColor: '#ffdbac',
            hairColor: '#4b2c20',
            hairStyle: 'default',
            outfitColor: '#646cff',
            outfitId: 'basic',
            gender: 'male'
        };
        const x = isNaN(Number(playerInfo.x)) ? 400 : Number(playerInfo.x);
        const y = isNaN(Number(playerInfo.y)) ? 300 : Number(playerInfo.y);

        console.log(`👥 Adding other player: ${playerInfo.name} at (${x}, ${y})`);
        const char = new Character(this, x, y, playerInfo.name, custom);
        char.setDepth(9);
        char.syncAlpha(0.2);
        this.otherPlayers.set(playerInfo.id, char);
    }
}
