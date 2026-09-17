import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { Character } from './Character';
import { BASE_WIDTH, BASE_HEIGHT } from './GameConfig';
import { defaultCustomization } from './lpcCatalog';
import { Pet } from './Pet';
import type { PetDirection, PetGrowthStage } from './petCatalog';

const DEFAULT_CUSTOMIZATION = defaultCustomization();

interface PetState {
    id: string;
    ownerUserId: string;
    nickname: string;
    breedId: string;
    growthStage: PetGrowthStage;
    hunger: number;
    energy: number;
    bond: number;
    mode: 'idle' | 'following' | 'sleeping';
    room: string;
    x?: number;
    y?: number;
}

export default class GameScene extends Phaser.Scene {
    private player?: Character;
    private otherPlayers: Map<string, Character> = new Map();
    private myPet?: Pet;
    private myPetState?: PetState;
    private otherPets: Map<string, Pet> = new Map(); // keyed by ownerUserId
    private petHouse?: Phaser.GameObjects.Container;
    private petHouseHint?: Phaser.GameObjects.Container;
    private petVelocityX = 0;
    private petVelocityY = 0;
    private petLastFacing: PetDirection = 'left';
    private petLastEmitTime = 0;
    private static readonly PET_HOUSE_X = 150;
    private static readonly PET_HOUSE_Y = 470;
    private static readonly PET_FOLLOW_DISTANCE = 45;
    private static readonly PET_SPEED = 160;
    private socket?: Socket;
    private userData?: any;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private static readonly MIN_ZOOM = 0.1;
    private static readonly MAX_ZOOM = 2;
    private currentZoom = 1;

    private setZoom(zoom: number) {
        this.currentZoom = Phaser.Math.Clamp(zoom, GameScene.MIN_ZOOM, GameScene.MAX_ZOOM);
        // The canvas backing store is rendered larger than the logical
        // 800x600 viewport (see GameConfig.computeGameSize, which sizes it
        // to the window's actual covered pixels x devicePixelRatio, so the
        // browser never has to upscale it — that upscaling was the source
        // of blurry/pixelated characters). Compensate with a baseline zoom
        // equal to that resolution multiplier so world-units-per-screen-
        // pixel — and therefore updateCameraBounds()/updateFollowState(),
        // which are written in terms of the logical VIEWPORT_WIDTH/HEIGHT —
        // stay exactly as if the canvas were still 800x600.
        const baselineZoom = this.scale.width / GameScene.VIEWPORT_WIDTH;
        this.cameras.main.setZoom(this.currentZoom * baselineZoom);
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

    private handlePetCommand = (e: CustomEvent<{ action: string, nickname?: string, breedId?: string }>) => {
        const { action, nickname, breedId } = e.detail || ({} as any);
        if (action === 'adopt') this.socket?.emit('pet:adopt', { nickname, breedId });
        else if (action === 'feed') this.socket?.emit('pet:feed');
        else if (action === 'rename') this.socket?.emit('pet:rename', { nickname });
        else if (action === 'follow') this.socket?.emit('pet:setMode', { mode: 'following' });
        else if (action === 'sleep') this.socket?.emit('pet:setMode', { mode: 'sleeping' });
        else if (action === 'idle') this.socket?.emit('pet:setMode', { mode: 'idle' });
        else if (action === 'remove') this.socket?.emit('pet:remove');
    };

    // --- Day / Night cycle -------------------------------------------------
    //
    // 'night': the whole viewport is darkened except a soft circular patch
    // around the player (~2 "tiles" — this world has no tile grid, so a
    // tile is treated as one character-width, TILE below) that follows them
    // as they move, like a torch. Implemented with the standard Phaser
    // RenderTexture "fog of war" technique: a screen-locked RenderTexture is
    // filled solid dark every frame, then a soft radial-gradient brush is
    // stamped out of it (blend mode ERASE) at the player's current SCREEN
    // position — recomputed each frame from world position + camera
    // scroll/zoom, since the overlay itself stays screen-locked
    // (scrollFactor 0) rather than panning/zooming with the world.
    // 'morning': a light warm-color wash over the whole scene, no darkening.
    // 'day' (default): no overlay at all.
    private dayNightMode: 'day' | 'morning' | 'night' = 'day';
    private nightOverlay?: Phaser.GameObjects.RenderTexture;
    private lightBrush?: Phaser.GameObjects.Image; // punches the dark overlay fully transparent (reveals true scene brightness)
    private morningTint?: Phaser.GameObjects.Rectangle;
    private static readonly TILE = 64; // matches Character.BODY_SIZE — the closest thing this free-roam world has to a tile unit
    private static readonly NIGHT_LIGHT_DIAMETER = GameScene.TILE * 4; // ~2 tiles' radius of visibility around the player
    // The Character container's own (x,y) anchor sits near the feet/shadow
    // (see Character.BODY_Y), not the sprite's visual center — shift the
    // light up so it's centered on the character instead of favoring the
    // legs and leaving the head/torso in the gradient's dimmer fringe.
    private static readonly NIGHT_LIGHT_Y_OFFSET = 20;

    private createRadialTexture(key: string, size: number, stops: { offset: number; color: string }[]) {
        if (this.textures.exists(key)) return;
        const canvasTexture = this.textures.createCanvas(key, size, size);
        if (!canvasTexture) return;
        const ctx = canvasTexture.getContext();
        const c = size / 2;
        const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
        stops.forEach((s) => gradient.addColorStop(s.offset, s.color));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        canvasTexture.refresh();
    }

    private createNightLightTextures() {
        const size = GameScene.NIGHT_LIGHT_DIAMETER;
        this.createRadialTexture('nightLightMask', size, [
            { offset: 0, color: 'rgba(255,255,255,1)' },
            { offset: 0.55, color: 'rgba(255,255,255,1)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
        ]);
    }

    private handleDayNightEvent = (e: Event) => {
        const mode = (e as CustomEvent<{ mode: 'day' | 'morning' | 'night' }>).detail?.mode;
        if (!mode) return;
        this.dayNightMode = mode;
        this.morningTint?.setVisible(mode === 'morning');
        this.nightOverlay?.setVisible(mode === 'night');
        if (mode !== 'night') this.nightOverlay?.clear();
    };

    // Re-fills and re-punches the night overlay for the current frame —
    // called from update() only while in night mode and once the player
    // exists. Cheap: one clear, one fill, one erase, one draw call per frame.
    private updateNightOverlay() {
        if (!this.nightOverlay || !this.lightBrush || !this.player) return;
        const cam = this.cameras.main;
        // World-to-screen projection: naively doing `(worldX - scrollX) *
        // zoom` looked right in isolated testing but was actually wrong in
        // this scene — verified with a throwaway harness that scrollX here
        // is not what that formula assumes (this project's baseline-zoom
        // compensation, camera-follow lerp, and bounds clamping all feed
        // into it), which showed up as the light rendering well away from
        // the character. Feeding the world point through the camera's own
        // transform matrix (the exact same one Phaser uses to place every
        // other sprite) sidesteps needing to re-derive that formula and is
        // correct regardless of zoom/bounds/origin quirks.
        // `matrix` exists at runtime (Phaser.Cameras.Scene2D.Camera extends
        // BaseCamera, which owns it) but isn't in Phaser's own .d.ts, hence the cast.
        const camMatrix = (cam as unknown as { matrix: Phaser.GameObjects.Components.TransformMatrix }).matrix;
        const point = camMatrix.transformPoint(
            this.player.x - cam.scrollX,
            this.player.y - GameScene.NIGHT_LIGHT_Y_OFFSET - cam.scrollY
        );
        const screenX = point.x;
        const screenY = point.y;
        const lightSize = GameScene.NIGHT_LIGHT_DIAMETER * cam.zoom;

        this.lightBrush.setDisplaySize(lightSize, lightSize);

        this.nightOverlay.clear();
        this.nightOverlay.fill(0x05060c, 0.88);
        this.nightOverlay.erase(this.lightBrush, screenX, screenY);
    }

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
        this.load.image('pet_house', '/pet-assets/dog_house_red.png');

        // Character layers are LPC spritesheets loaded on demand per-layer
        // by lpcLoader.ts (see Character.ts) — not preloaded here, since the
        // full asset pack is ~2,650 files and only a handful are ever
        // selected by any one character.

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
    private static readonly VIEWPORT_WIDTH = BASE_WIDTH;
    private static readonly VIEWPORT_HEIGHT = BASE_HEIGHT;
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
        this.interactHint = this.add.container(150, 100).setAlpha(0).setDepth(10000);
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

        // 🐾 Pet House — a fixed marker in the Garden Pathway; the owner's
        // pet rests here by default and "sleeps" here when sent to sleep.
        // Art: Revouger's "Top-Down Pet Props" (see client/CREDITS.md).
        const { PET_HOUSE_X, PET_HOUSE_Y } = GameScene;
        this.petHouse = this.add.container(PET_HOUSE_X, PET_HOUSE_Y).setDepth(PET_HOUSE_Y);
        this.textures.get('pet_house').setFilter(Phaser.Textures.FilterMode.NEAREST);
        const houseShadow = this.add.ellipse(0, 26, 46, 14, 0x000000, 0.3);
        const houseSprite = this.add.image(0, 0, 'pet_house');
        houseSprite.setDisplaySize(72, 72);
        this.petHouse.add([houseShadow, houseSprite]);

        this.petHouseHint = this.add.container(PET_HOUSE_X, PET_HOUSE_Y - 60).setAlpha(0).setDepth(10000);
        const petHintBg = this.add.graphics();
        petHintBg.fillStyle(0xffffff, 0.2);
        petHintBg.fillRoundedRect(-55, -15, 110, 30, 15);
        petHintBg.lineStyle(1, 0xffffff, 0.5);
        petHintBg.strokeRoundedRect(-55, -15, 110, 30, 15);
        const petHintText = this.add.text(0, 0, '[F] PET HOUSE', {
            fontSize: '10px',
            fontFamily: 'Inter, sans-serif',
            color: '#ffffff',
            fontStyle: '600'
        }).setOrigin(0.5);
        this.petHouseHint.add([petHintBg, petHintText]);

        this.input.keyboard?.on('keydown-F', () => {
            if (this.petHouseHint?.alpha === 1) {
                window.dispatchEvent(new CustomEvent('pet-house-interact', {
                    detail: { hasPet: !!this.myPetState }
                }));
            }
        });

        // UI Setup: Top Bar
        this.roomBar = this.add.graphics().setScrollFactor(0).setDepth(10001);
        this.roomLabel = this.add.text(400, 22, this.homeName, {
            fontSize: '13px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#ffffff',
            fontStyle: '500'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);

        this.updateRoomUI('🏠 Home', true);

        // 🔍 Zoom Control (range slider, mouse wheel, and trackpad/touch pinch)
        this.setZoom(1);
        window.addEventListener('game-zoom', this.handleZoomEvent);

        // 🌗 Day / Night Control — overlays are screen-locked (scrollFactor 0)
        // and sized to the current viewport; depth 9000 keeps them above the
        // background/furniture/characters but below the interact hint (10000)
        // and room bar (10001-10002) so UI text stays fully legible.
        this.createNightLightTextures();
        this.nightOverlay = this.add.renderTexture(0, 0, this.scale.width, this.scale.height)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(9000)
            .setVisible(false);
        this.lightBrush = this.add.image(0, 0, 'nightLightMask').setVisible(false);
        this.morningTint = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffb066, 0.16)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(9000)
            .setVisible(false);
        window.addEventListener('day-night-mode', this.handleDayNightEvent);

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

        const mouseDownHandler = (e: MouseEvent) => {
            if (e.button !== 0) return; // right/middle click drive the character context menu, not panning
            beginPan(e.clientX, e.clientY);
        };
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
            window.removeEventListener('day-night-mode', this.handleDayNightEvent);
            window.removeEventListener('pet-command', this.handlePetCommand as EventListener);
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
        // Character walk animations are created lazily per-layer-texture by
        // lpcLoader.ts's ensureWalkAnimsForTexture() as each layer loads.

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

        // Broadcast when anyone (including ourselves) saves a new look —
        // without this, a saved customization change never appears until
        // the page is reloaded, since characters otherwise only read
        // customization once, at construction time.
        this.socket.on('profileUpdated', (p: any) => {
            if (!p?.customization) return;
            if (p.id === this.socket?.id) {
                this.player?.updateCustomization(p.customization);
            } else {
                this.otherPlayers.get(p.id)?.updateCustomization(p.customization);
            }
        });

        // 🐾 Pet Sync
        const myUserId = this.userData?.sub;
        this.socket.on('pet:currentPets', (pets: Record<string, PetState>) => {
            Object.values(pets).forEach((pet) => this.upsertPet(pet));
        });
        this.socket.on('pet:adopted', (pet: PetState) => this.upsertPet(pet));
        this.socket.on('pet:updated', (pet: PetState) => this.upsertPet(pet));
        this.socket.on('pet:moved', (data: { ownerUserId: string, x: number, y: number, direction?: PetDirection }) => {
            if (data.ownerUserId === myUserId) return;
            const pet = this.otherPets.get(data.ownerUserId);
            if (!pet) return;
            this.tweens.add({ targets: pet, x: data.x, y: data.y, duration: 150, ease: 'Linear' });
            if (data.direction) pet.playAnimation(data.direction);
            else pet.stopAnimation();
        });
        this.socket.on('pet:removed', (data: { ownerUserId: string }) => {
            window.dispatchEvent(new CustomEvent('pet-removed', { detail: data }));
            if (data.ownerUserId === myUserId) {
                this.myPet?.destroy();
                this.myPet = undefined;
                this.myPetState = undefined;
            } else {
                this.otherPets.get(data.ownerUserId)?.destroy();
                this.otherPets.delete(data.ownerUserId);
            }
        });

        // React UI (PetPanel) -> game actions
        window.addEventListener('pet-command', this.handlePetCommand as EventListener);

        // PetPanel/PetContextMenu mount long after the initial pet sync (the
        // user has to click to open them) and would otherwise miss the
        // one-shot 'pet-state'/'pet-removed' broadcasts fired back on join —
        // this lets them ask for the current state on mount instead of
        // depending on catching a past event.
        window.addEventListener('pet-request-state', () => {
            if (this.myPetState) {
                window.dispatchEvent(new CustomEvent('pet-state', { detail: this.myPetState }));
            } else if (myUserId) {
                window.dispatchEvent(new CustomEvent('pet-removed', { detail: { ownerUserId: myUserId } }));
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

    private upsertPet(pet: PetState) {
        const myUserId = this.userData?.sub;
        window.dispatchEvent(new CustomEvent('pet-state', { detail: pet }));

        if (pet.ownerUserId === myUserId) {
            this.myPetState = pet;
            if (!this.myPet) {
                const { PET_HOUSE_X, PET_HOUSE_Y } = GameScene;
                this.myPet = new Pet(this, PET_HOUSE_X, PET_HOUSE_Y + 30, pet.nickname, pet.breedId, pet.growthStage, true);
                this.myPet.setDepth(PET_HOUSE_Y + 30);
                this.myPet.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                    if (!pointer.rightButtonDown()) return;
                    const evt = pointer.event as MouseEvent;
                    window.dispatchEvent(new CustomEvent('pet-context-menu', {
                        detail: { x: evt.clientX, y: evt.clientY }
                    }));
                });
            }
            this.myPet.updateNickname(pet.nickname);
            this.myPet.updateGrowthStage(pet.growthStage);
            this.myPet.updateBreed(pet.breedId);
            this.myPet.setSleeping(pet.mode === 'sleeping');
        } else {
            let otherPet = this.otherPets.get(pet.ownerUserId);
            if (!otherPet) {
                const { PET_HOUSE_X, PET_HOUSE_Y } = GameScene;
                otherPet = new Pet(this, pet.x ?? PET_HOUSE_X, pet.y ?? PET_HOUSE_Y + 30, pet.nickname, pet.breedId, pet.growthStage);
                this.otherPets.set(pet.ownerUserId, otherPet);
            }
            otherPet.updateNickname(pet.nickname);
            otherPet.updateGrowthStage(pet.growthStage);
            otherPet.updateBreed(pet.breedId);
            otherPet.setSleeping(pet.mode === 'sleeping');
        }
    }

    private speed = 180; // Pixels per second
    private lastEmitTime = 0;
    private velocityX = 0;
    private velocityY = 0;
    private lastAnimKey = '';
    private static readonly ACCEL = 12; // Higher = snappier ramp to full speed
    private static readonly STOP_THRESHOLD = 3; // px/s below which we call it "stopped"

    update(time: number, delta: number) {
        if (this.player && this.cursors) {
            // 0. Depth (Y) Sort — characters further down the room should
            // render in front of ones further up, so movement reads correctly
            // as characters cross paths.
            this.player.setDepth(this.player.y);
            this.otherPlayers.forEach(char => char.setDepth(char.y));
            this.myPet?.setDepth(this.myPet.y);
            this.otherPets.forEach(pet => pet.setDepth(pet.y));

            if (this.dayNightMode === 'night') this.updateNightOverlay();

            // Pet House Proximity Hint
            if (this.petHouse && this.petHouseHint) {
                const distToHouse = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.petHouse.x, this.petHouse.y);
                this.petHouseHint.setAlpha(distToHouse < 80 ? 1 : 0);
            }

            this.updatePetFollow(delta, time);

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

            // 2. Smooth Movement — ease toward a target velocity instead of
            // snapping straight to full speed, so starting/stopping feels
            // weighted rather than robotic.
            let targetX = 0;
            let targetY = 0;
            let animKey = '';

            if (this.cursors.left.isDown) { targetX = -this.speed; animKey = 'walk_left'; }
            else if (this.cursors.right.isDown) { targetX = this.speed; animKey = 'walk_right'; }

            if (this.cursors.up.isDown) { targetY = -this.speed; animKey = 'walk_up'; }
            else if (this.cursors.down.isDown) { targetY = this.speed; animKey = 'walk_down'; }

            const isInputActive = targetX !== 0 || targetY !== 0;
            if (isInputActive && targetX !== 0 && targetY !== 0) {
                // Normalize for diagonal movement
                targetX *= Math.SQRT1_2;
                targetY *= Math.SQRT1_2;
            }
            if (isInputActive) this.lastAnimKey = animKey;

            // Framerate-independent exponential smoothing toward the target velocity
            const smoothing = 1 - Math.exp(-GameScene.ACCEL * (delta / 1000));
            this.velocityX += (targetX - this.velocityX) * smoothing;
            this.velocityY += (targetY - this.velocityY) * smoothing;

            const isMoving = Math.hypot(this.velocityX, this.velocityY) > GameScene.STOP_THRESHOLD;

            if (isMoving) {
                this.player.x += this.velocityX * (delta / 1000);
                this.player.y += this.velocityY * (delta / 1000);
                this.player.x = Phaser.Math.Clamp(this.player.x, 20, GameScene.BG_WIDTH - 20);
                this.player.y = Phaser.Math.Clamp(this.player.y, 20, GameScene.BG_HEIGHT - 20);

                const activeAnimKey = isInputActive ? animKey : this.lastAnimKey;
                this.player.playAnimation(activeAnimKey);

                // Walking resumes camera-follow in case a manual drag released
                // it (unless still zoomed out enough that the whole image fits)
                this.updateFollowState();

                // Throttle socket updates
                if (time - this.lastEmitTime > 50) {
                    this.lastEmitTime = time;
                    this.socket?.emit('playerMovement', { x: this.player.x, y: this.player.y, animationKey: activeAnimKey });
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

    // Same exponential-smoothing seek used for the player's own movement,
    // but with a "keep distance" leash instead of driving to an exact point
    // — following stops an arm's length behind the owner rather than
    // stacking on top of them.
    private updatePetFollow(delta: number, time: number) {
        if (!this.myPet || !this.myPetState || !this.player) return;
        const mode = this.myPetState.mode;

        let targetX: number | null = null;
        let targetY: number | null = null;
        let keepDistance = 0;

        if (mode === 'following') {
            targetX = this.player.x;
            targetY = this.player.y;
            keepDistance = GameScene.PET_FOLLOW_DISTANCE;
        } else if (mode === 'sleeping') {
            targetX = GameScene.PET_HOUSE_X;
            targetY = GameScene.PET_HOUSE_Y + 30;
            keepDistance = 4;
        }

        if (targetX === null || targetY === null) {
            this.petVelocityX = 0;
            this.petVelocityY = 0;
            this.myPet.stopAnimation();
            return;
        }

        const dx = targetX - this.myPet.x;
        const dy = targetY - this.myPet.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= keepDistance) {
            this.petVelocityX = 0;
            this.petVelocityY = 0;
            this.myPet.stopAnimation();
            return;
        }

        const dirX = dx / distance;
        const dirY = dy / distance;
        const smoothing = 1 - Math.exp(-GameScene.ACCEL * (delta / 1000));
        this.petVelocityX += (dirX * GameScene.PET_SPEED - this.petVelocityX) * smoothing;
        this.petVelocityY += (dirY * GameScene.PET_SPEED - this.petVelocityY) * smoothing;

        this.myPet.x += this.petVelocityX * (delta / 1000);
        this.myPet.y += this.petVelocityY * (delta / 1000);

        // 'up' has real back-view art (petCatalog.ts's header), so it gets
        // its own animation. 'down' has no toward-camera art at all — using
        // the back view there would show the pet's rear while it's
        // supposedly approaching, which reads as walking backwards. So
        // "down" instead keeps showing the side profile, whichever way it
        // was last actually facing, rather than switching pose.
        let facing: PetDirection;
        if (Math.abs(this.petVelocityX) > Math.abs(this.petVelocityY)) {
            facing = this.petVelocityX > 0 ? 'right' : 'left';
            this.petLastFacing = facing;
        } else if (this.petVelocityY < 0) {
            facing = 'up';
        } else {
            facing = this.petLastFacing;
        }
        this.myPet.playAnimation(facing);

        if (time - this.petLastEmitTime > 100) {
            this.petLastEmitTime = time;
            this.socket?.emit('pet:move', { x: this.myPet.x, y: this.myPet.y, direction: facing });
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
        const custom = playerInfo.customization || DEFAULT_CUSTOMIZATION;
        this.player = new Character(this, x, y, playerInfo.name, custom);
        this.player.setDepth(10);
        this.player.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.rightButtonDown()) return;
            const evt = pointer.event as MouseEvent;
            window.dispatchEvent(new CustomEvent('character-context-menu', {
                detail: { x: evt.clientX, y: evt.clientY }
            }));
        });
        this.updateFollowState();
    }

    addOtherPlayers(playerInfo: any) {
        if (!playerInfo || this.otherPlayers.has(playerInfo.id)) return;
        const x = isNaN(Number(playerInfo.x)) ? 400 : Number(playerInfo.x);
        const y = isNaN(Number(playerInfo.y)) ? 300 : Number(playerInfo.y);
        const custom = playerInfo.customization || DEFAULT_CUSTOMIZATION;
        const char = new Character(this, x, y, playerInfo.name, custom);
        char.setDepth(9);
        char.syncAlpha(0.15);
        this.otherPlayers.set(playerInfo.id, char);
    }
}
