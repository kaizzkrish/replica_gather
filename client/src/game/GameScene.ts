import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { Character } from './Character';

export default class GameScene extends Phaser.Scene {
    private player?: Character;
    private otherPlayers: Map<string, Character> = new Map();
    private socket?: Socket;
    private userData?: any;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor() {
        super('GameScene');
    }

    init(data: { socket: Socket, user: any }) {
        this.socket = data.socket;
        this.userData = data.user;
    }

    preload() {
        this.load.image('home_background', '/home_background.png');
        this.load.image('furniture_office', '/furniture_office.png');
        this.load.image('furniture_gaming', '/furniture_gaming.png');
        this.load.image('furniture_home', '/furniture_home.png');

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

    private roomLabel?: Phaser.GameObjects.Text;
    private roomBar?: Phaser.GameObjects.Graphics;
    private currentRoomName: string = '';

    private rooms = [
        { name: '🛏️ Master Bedroom', x: 600, y: 30, w: 180, h: 220, private: true },
        { name: '🍳 Kitchenette & Dining', x: 600, y: 300, w: 180, h: 280, private: true },
        { name: '📍 Srikrishnan\'s Desk', x: 430, y: 240, w: 140, h: 140, private: true },
        { name: '🛋️ Executive Lounge', x: 440, y: 440, w: 280, h: 140, private: true },
        { name: '📚 Private Library', x: 430, y: 30, w: 140, h: 180, private: true },
        { name: '🌲 Garden Pathway', x: 20, y: 20, w: 380, h: 560, private: false },
    ];

    private homeBoard?: Phaser.GameObjects.Container;
    private interactHint?: Phaser.GameObjects.Container;
    private homeName: string = "SRIKRISHNAN'S LUXURY HOME";

    create() {
        if (!this.socket) return;

        // Background: Exact Gather Style
        const bg = this.add.image(400, 300, 'home_background').setDepth(-100);
        bg.setDisplaySize(800, 600);

        // 🏠 Stylish Home Hub Board (Now in Garden)
        this.homeBoard = this.add.container(150, 150).setDepth(5);
        const boardBg = this.add.graphics();
        boardBg.fillStyle(0x2d3436, 0.9);
        boardBg.fillRoundedRect(-70, -20, 140, 40, 8);
        boardBg.lineStyle(2, 0x0984e3, 1);
        boardBg.strokeRoundedRect(-70, -20, 140, 40, 8);
        
        const boardText = this.add.text(0, 0, '🏠 OUR LITTLE SPACE', {
            fontSize: '11px',
            fontFamily: 'Inter, sans-serif',
            color: '#ffffff',
            fontStyle: '800'
        }).setOrigin(0.5);
        
        this.homeBoard.add([boardBg, boardText]);

        // ✨ Proximity Hint (Shifted with Board)
        this.interactHint = this.add.container(150, 100).setAlpha(0).setDepth(100);
        const hintBg = this.add.graphics();
        hintBg.fillStyle(0xffffff, 0.2);
        hintBg.fillRoundedRect(-50, -15, 100, 30, 15);
        hintBg.lineStyle(1, 0xffffff, 0.5);
        hintBg.strokeRoundedRect(-50, -15, 100, 30, 15);
        
        const hintText = this.add.text(0, 0, '[E] CUSTOMIZE', {
            fontSize: '10px',
            fontFamily: 'Inter, sans-serif',
            color: '#ffffff',
            fontStyle: '600'
        }).setOrigin(0.5);
        this.interactHint.add([hintBg, hintText]);

        // UI Setup: Top Bar
        this.roomBar = this.add.graphics().setScrollFactor(0).setDepth(1000);
        this.roomLabel = this.add.text(400, 22, this.homeName, {
            fontSize: '13px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#ffffff',
            fontStyle: '500'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        this.updateRoomUI('🏠 Home', true);
        
        // Input for E key (Now Global & Persistent)
        this.input.keyboard?.on('keydown-E', () => {
            if (this.interactHint?.alpha === 1 && this.currentRoomName !== '🛋️ Executive Lounge') {
                const newName = prompt("Enter Home Name (Saves to DB):", this.homeName);
                if (newName) {
                    this.socket?.emit('updateHomeName', { name: newName.toUpperCase() });
                }
            }
        });

        // Input for ENTER key (YouTube in Lounge)
        this.input.keyboard?.on('keydown-ENTER', () => {
            if (this.currentRoomName === '🛋️ Executive Lounge') {
                window.dispatchEvent(new CustomEvent('open-youtube'));
            }
        });

        // 🏠 Global Space Sync (Saves to Everyone's UI)
        this.socket.on('homeNameUpdated', (data: { name: string }) => {
            this.homeName = data.name.toUpperCase();
            this.updateRoomUI(this.currentRoomName || '🏠 Home');
        });
        const baseTextures = ['charBase', 'charBase_female'];
        const directions = ['down', 'left', 'right', 'up'];

        baseTextures.forEach(tex => {
            const prefix = tex === 'charBase' ? '' : 'female_';
            directions.forEach((dir, index) => {
                this.anims.create({
                    key: `${prefix}walk_${dir}`,
                    frames: this.anims.generateFrameNumbers(tex, { start: index * 4, end: index * 4 + 3 }),
                    frameRate: 10,
                    repeat: -1
                });
            });
        });

        // Listeners
        this.socket.on('currentPlayers', (players: any) => {
            Object.keys(players).forEach((id) => {
                if (id === this.socket?.id) this.addPlayer(players[id]);
                else this.addOtherPlayers(players[id]);
            });
        });

        this.socket.on('newPlayer', (p: any) => this.addOtherPlayers(p));
        this.socket.on('playerMoved', (p: any) => {
            const char = this.otherPlayers.get(p.id);
            if (char) {
                this.tweens.add({ targets: char, x: p.x, y: p.y, duration: 150, ease: 'Linear' });
                if (p.animationKey) char.playAnimation(p.animationKey);
                else char.stopAnimation();
            }
        });

        this.socket.on('playerDisconnected', (id: string) => {
            const char = this.otherPlayers.get(id);
            if (char) { char.destroy(); this.otherPlayers.delete(id); }
        });

        this.socket.on('profileUpdated', (p: any) => {
            if (!p) return;
            const targetChar = p.id === this.socket?.id ? this.player : this.otherPlayers.get(p.id);
            if (targetChar) {
                targetChar.updateName(p.name);
                if (p.customization) targetChar.updateCustomization(p.customization);
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

    private speed = 180; // Pixels per second
    private lastEmitTime = 0;

    update(time: number, delta: number) {
        if (this.player && this.cursors) {
            // 1. Room Detection
            const currentRoom = this.rooms.find(r =>
                this.player!.x >= r.x && this.player!.x < r.x + r.w &&
                this.player!.y >= r.y && this.player!.y < r.y + r.h
            );

            if (currentRoom && currentRoom.name !== this.currentRoomName) {
                this.currentRoomName = currentRoom.name;
                this.updateRoomUI(currentRoom.name);
            } else if (!currentRoom && this.currentRoomName !== '🏠 Home') {
                this.currentRoomName = '🏠 Home';
                this.updateRoomUI('🏠 Home');
            }

            // 2. Smooth Movement
            let velocityX = 0;
            let velocityY = 0;
            let animKey = '';

            if (this.cursors.left.isDown) { velocityX = -this.speed; animKey = 'walk_left'; }
            else if (this.cursors.right.isDown) { velocityX = this.speed; animKey = 'walk_right'; }
            
            if (this.cursors.up.isDown) { velocityY = -this.speed; animKey = 'walk_up'; }
            else if (this.cursors.down.isDown) { velocityY = this.speed; animKey = 'walk_down'; }

            if (velocityX !== 0 || velocityY !== 0) {
                // Normalize for diagonal movement
                if (velocityX !== 0 && velocityY !== 0) {
                    velocityX *= Math.SQRT1_2;
                    velocityY *= Math.SQRT1_2;
                }

                this.player.x += velocityX * (delta / 1000);
                this.player.y += velocityY * (delta / 1000);
                this.player.x = Phaser.Math.Clamp(this.player.x, 20, 780);
                this.player.y = Phaser.Math.Clamp(this.player.y, 20, 580);
                
                this.player.playAnimation(animKey);

                // Throttle socket updates
                if (time - this.lastEmitTime > 50) {
                    this.lastEmitTime = time;
                    this.socket?.emit('playerMovement', { x: this.player.x, y: this.player.y, animationKey: animKey });
                }
            } else {
                this.player.stopAnimation();
                if (time - this.lastEmitTime > 100) { // Still sync idle state
                    this.lastEmitTime = time;
                    this.socket?.emit('playerMovement', { x: this.player.x, y: this.player.y, animationKey: '' });
                }
            }

            // 3. Hub Proximity Interaction
            if (this.homeBoard && this.interactHint) {
                const distToBoard = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.homeBoard.x, this.homeBoard.y);

                if (distToBoard < 80) {
                    this.interactHint.setAlpha(1);
                    this.interactHint.y = this.homeBoard.y - 50; 
                    this.interactHint.x = this.homeBoard.x;
                    (this.interactHint.list[1] as Phaser.GameObjects.Text).setText('[E] CUSTOMIZE NAME');
                } else {
                    this.interactHint.setAlpha(0);
                }
            }

            // 4. Proximity Logic
            const nearbyIds: string[] = [];
            const pRoom = this.rooms.find(r => this.player!.x >= r.x && this.player!.x < r.x + r.w && this.player!.y >= r.y && this.player!.y < r.y + r.h);

            this.otherPlayers.forEach((char, id) => {
                const cRoom = this.rooms.find(r => char.x >= r.x && char.x < r.x + r.w && char.y >= r.y && char.y < r.y + r.h);
                const isSamePrivate = pRoom && cRoom && pRoom.name === cRoom.name && pRoom.private;
                const distance = Phaser.Math.Distance.Between(this.player!.x, this.player!.y, char.x, char.y);
                const isClose = distance < 120;

                char.syncAlpha(1); // Always visible

                if (isSamePrivate || (isClose && (!pRoom?.private && !cRoom?.private))) {
                    nearbyIds.push(id);
                }
            });

            // 4. Global Event Dispatch
            const payload = JSON.stringify(nearbyIds);
            if ((this as any).lastNearbyPayload !== payload) {
                (this as any).lastNearbyPayload = payload;
                window.dispatchEvent(new CustomEvent('nearby-players-change', {
                    detail: {
                        playerIds: nearbyIds,
                        playerNames: nearbyIds.map(id => this.otherPlayers.get(id)?.name || 'Unknown')
                    }
                }));
            }
        }
    }

    private updateRoomUI(name: string, instant: boolean = false) {
        if (!this.roomBar || !this.roomLabel) return;
        
        const isHome = name === '🏠 Home';
        this.roomLabel.setText(isHome ? '🏠 Home' : `📍 ${name}`);
        const textWidth = this.roomLabel.width;
        
        this.tweens.killTweensOf([this.roomLabel, this.roomBar]);

        if (instant) {
            this.roomLabel.setY(22);
            this.roomBar.clear().fillStyle(0x2d3436, 0.8).fillRoundedRect(400 - (textWidth + 30) / 2, 8, textWidth + 30, 28, 14);
            return;
        }

        this.roomLabel.setY(-20);
        this.tweens.add({ targets: this.roomLabel, y: 22, duration: 400, ease: 'Cubic.easeOut' });

        this.roomBar.clear();
        this.roomBar.fillStyle(0x2d3436, 0.8);
        this.roomBar.fillRoundedRect(400 - (textWidth + 30) / 2, 8, textWidth + 30, 28, 14);
    }

    addPlayer(playerInfo: any) {
        if (!playerInfo) return;
        const x = isNaN(Number(playerInfo.x)) ? 400 : Number(playerInfo.x);
        const y = isNaN(Number(playerInfo.y)) ? 300 : Number(playerInfo.y);
        const custom = playerInfo.customization || { skinColor: '#ffdbac', hairColor: '#4b2c20', hairStyle: 'default', outfitColor: '#646cff', outfitId: 'basic', gender: 'male' };
        this.player = new Character(this, x, y, playerInfo.name, custom);
        this.player.setDepth(10);
    }

    addOtherPlayers(playerInfo: any) {
        if (!playerInfo || this.otherPlayers.has(playerInfo.id)) return;
        const x = isNaN(Number(playerInfo.x)) ? 400 : Number(playerInfo.x);
        const y = isNaN(Number(playerInfo.y)) ? 300 : Number(playerInfo.y);
        const custom = playerInfo.customization || { skinColor: '#ffdbac', hairColor: '#4b2c20', hairStyle: 'default', outfitColor: '#646cff', outfitId: 'basic', gender: 'male' };
        const char = new Character(this, x, y, playerInfo.name, custom);
        char.setDepth(9);
        char.syncAlpha(0.15);
        this.otherPlayers.set(playerInfo.id, char);
    }
}
