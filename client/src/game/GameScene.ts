import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { Character } from './Character';

export default class GameScene extends Phaser.Scene {
    private player?: Character;
    private otherPlayers: Map<string, Character> = new Map();
    private socket?: Socket;
    private userData?: any;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private static readonly MIN_ZOOM = 0.1;
    private static readonly MAX_ZOOM = 2;
    private currentZoom = 1;

    private setZoom(zoom: number) {
        this.currentZoom = Phaser.Math.Clamp(zoom, GameScene.MIN_ZOOM, GameScene.MAX_ZOOM);
        this.cameras.main.setZoom(this.currentZoom);
        this.updateCameraBounds();
        this.updateFollowState();
        // Keep the on-screen slider in sync with wheel/pinch driven changes
        window.dispatchEvent(new CustomEvent('game-zoom-sync', { detail: { zoom: this.currentZoom } }));
    }

    // When zoomed out far enough that the background is smaller than the
    // viewport, Phaser forces the camera to a single fixed scroll position
    // (its bounds-clamp has no range left to clamp within) — but that
    // forced position is derived from raw bounds.x/y, so leaving them at
    // (0,0) pins the image into the top-left corner instead of centering
    // it. Shifting the bounds' origin by half the leftover space corrects
    // for that (verified against Phaser's own Camera.preRender source).
    private updateCameraBounds() {
        const { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, BG_WIDTH, BG_HEIGHT } = GameScene;
        const dw = VIEWPORT_WIDTH / this.currentZoom;
        const dh = VIEWPORT_HEIGHT / this.currentZoom;
        const boundsX = dw > BG_WIDTH ? (BG_WIDTH - dw) / 2 : 0;
        const boundsY = dh > BG_HEIGHT ? (BG_HEIGHT - dh) / 2 : 0;
        this.cameras.main.setBounds(boundsX, boundsY, BG_WIDTH, BG_HEIGHT);
    }

    // Once zoomed out far enough that the whole background fits inside the
    // viewport, there's nothing left to "follow" the player into, and
    // camera-follow's own per-frame lerp mixes zoomed/unzoomed units in a
    // way that fights the bounds clamp — so past that point we stop
    // following and just center the full image directly instead.
    private updateFollowState() {
        const { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, BG_WIDTH, BG_HEIGHT } = GameScene;
        const fitsEntirely = (VIEWPORT_WIDTH / this.currentZoom) >= BG_WIDTH
            && (VIEWPORT_HEIGHT / this.currentZoom) >= BG_HEIGHT;

        if (fitsEntirely) {
            this.cameras.main.stopFollow();
            this.cameras.main.centerOn(BG_WIDTH / 2, BG_HEIGHT / 2);
        } else if (this.player) {
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        }
    }

    private handleZoomEvent = (e: Event) => {
        const zoom = (e as CustomEvent<{ zoom: number }>).detail?.zoom;
        if (typeof zoom === 'number') this.setZoom(zoom);
    };

    constructor() {
        super('GameScene');
    }

    init(data: { socket: Socket, user: any }) {
        this.socket = data.socket;
        this.userData = data.user;
    }

    preload() {
        this.load.image('home_background', '/home_background_lavender.png');
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

    // Full background image, shown uncropped, native aspect ratio preserved.
    // Fixed at a size that fully covers the 800x600 viewport with no gaps
    // down to about 60% zoom, without stretching the source art too far
    // past its native resolution (which would look blurry once zoomed
    // back in). MIN_ZOOM goes lower than that on purpose — past ~60%
    // zoomed out, the whole image just shrinks into view with empty
    // canvas space around it rather than being blown up further.
    private static readonly VIEWPORT_WIDTH = 800;
    private static readonly VIEWPORT_HEIGHT = 600;
    private static readonly BG_HEIGHT = 1020;
    private static readonly BG_WIDTH = Math.ceil(GameScene.BG_HEIGHT * (2752 / 1536));

    create() {
        if (!this.socket) return;

        const { BG_WIDTH, BG_HEIGHT } = GameScene;

        // Background: full lavender home image, uncropped
        const bg = this.add.image(BG_WIDTH / 2, BG_HEIGHT / 2, 'home_background').setDepth(-100);
        bg.setDisplaySize(BG_WIDTH, BG_HEIGHT);

        // Camera can pan across the full image width; start centered on it
        this.cameras.main.setBounds(0, 0, BG_WIDTH, BG_HEIGHT);
        this.cameras.main.centerOn(BG_WIDTH / 2, BG_HEIGHT / 2);

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

        // 🔍 Zoom Control (range slider, mouse wheel, and trackpad/touch pinch)
        this.setZoom(1);
        window.addEventListener('game-zoom', this.handleZoomEvent);

        const canvas = this.sys.game.canvas;

        // Mouse scroll wheel + trackpad two-finger pinch (browsers report pinch
        // as a wheel event with ctrlKey set, since that's the native pinch-zoom gesture)
        const wheelHandler = (e: WheelEvent) => {
            e.preventDefault();
            const sensitivity = e.ctrlKey ? 0.02 : 0.001;
            this.setZoom(this.currentZoom - e.deltaY * sensitivity);
        };
        canvas.addEventListener('wheel', wheelHandler, { passive: false });

        // 🖐️ Drag-to-pan (mouse or single-finger touch) in all directions —
        // horizontally the background is wider than the viewport, and
        // vertically extra room opens up once the player zooms in.
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let panStartScrollX = 0;
        let panStartScrollY = 0;
        const beginPan = (clientX: number, clientY: number) => {
            isPanning = true;
            panStartX = clientX;
            panStartY = clientY;
            panStartScrollX = this.cameras.main.scrollX;
            panStartScrollY = this.cameras.main.scrollY;
            // Free-look: release camera-follow so the manual drag isn't
            // fought by the camera snapping back to the player each frame.
            // Walking (see update()) re-engages follow automatically.
            this.cameras.main.stopFollow();
        };
        const updatePan = (clientX: number, clientY: number) => {
            if (!isPanning) return;
            const zoom = this.cameras.main.zoom;
            this.cameras.main.scrollX = panStartScrollX - (clientX - panStartX) / zoom;
            this.cameras.main.scrollY = panStartScrollY - (clientY - panStartY) / zoom;
        };
        const endPan = () => { isPanning = false; };

        const mouseDownHandler = (e: MouseEvent) => beginPan(e.clientX, e.clientY);
        const mouseMoveHandler = (e: MouseEvent) => updatePan(e.clientX, e.clientY);
        canvas.addEventListener('mousedown', mouseDownHandler);
        window.addEventListener('mousemove', mouseMoveHandler);
        window.addEventListener('mouseup', endPan);

        // Two-finger pinch-to-zoom, one-finger drag-to-pan on touchscreens
        let pinchStartDistance = 0;
        let pinchStartZoom = 1;
        const touchDistance = (touches: TouchList) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.hypot(dx, dy);
        };
        const touchStartHandler = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                beginPan(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                isPanning = false;
                pinchStartDistance = touchDistance(e.touches);
                pinchStartZoom = this.currentZoom;
            }
        };
        const touchMoveHandler = (e: TouchEvent) => {
            if (e.touches.length === 1 && isPanning) {
                e.preventDefault();
                updatePan(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2 && pinchStartDistance > 0) {
                e.preventDefault();
                const scale = touchDistance(e.touches) / pinchStartDistance;
                this.setZoom(pinchStartZoom * scale);
            }
        };
        const touchEndHandler = () => { isPanning = false; pinchStartDistance = 0; };
        canvas.addEventListener('touchstart', touchStartHandler, { passive: true });
        canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
        canvas.addEventListener('touchend', touchEndHandler);
        canvas.addEventListener('touchcancel', touchEndHandler);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('game-zoom', this.handleZoomEvent);
            canvas.removeEventListener('wheel', wheelHandler);
            canvas.removeEventListener('mousedown', mouseDownHandler);
            window.removeEventListener('mousemove', mouseMoveHandler);
            window.removeEventListener('mouseup', endPan);
            canvas.removeEventListener('touchstart', touchStartHandler);
            canvas.removeEventListener('touchmove', touchMoveHandler);
            canvas.removeEventListener('touchend', touchEndHandler);
            canvas.removeEventListener('touchcancel', touchEndHandler);
        });

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
                this.player.x = Phaser.Math.Clamp(this.player.x, 20, GameScene.BG_WIDTH - 20);
                this.player.y = Phaser.Math.Clamp(this.player.y, 20, GameScene.BG_HEIGHT - 20);

                this.player.playAnimation(animKey);

                // Walking resumes camera-follow in case a manual drag released
                // it (unless still zoomed out enough that the whole image fits)
                this.updateFollowState();

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
        this.updateFollowState();
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
