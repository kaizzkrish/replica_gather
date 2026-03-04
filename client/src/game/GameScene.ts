import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import gatherIcon from '../assets/gather_icon.png';

export default class GameScene extends Phaser.Scene {
    private player?: Phaser.Physics.Arcade.Sprite;
    private playerNameText?: Phaser.GameObjects.Text;
    private otherPlayers!: Phaser.Physics.Arcade.Group;
    private otherPlayerNames: Map<string, Phaser.GameObjects.Text> = new Map();
    private socket?: Socket;
    private userData?: any;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private interactionRadius = 250;
    private lastMoveTime = 0;
    private moveInterval = 200; // Time in ms between movements
    private tileSize = 40;

    constructor() {
        super('GameScene');
    }

    init(data: { socket: Socket, user: any }) {
        console.log('Scene: INIT called with data:', !!data.socket, !!data.user);
        this.socket = data.socket;
        this.userData = data.user;
    }

    preload() {
        console.log('Scene: PRELOAD starting...');
        this.load.image('playerIcon', gatherIcon);
    }

    create() {
        console.log('Scene: CREATE starting...');
        this.otherPlayers = this.physics.add.group();
        if (!this.socket) {
            console.error('No socket available in scene!');
            return;
        }

        // 1. Draw solid floor
        this.add.rectangle(400, 300, 800, 600, 0x242424); // Dark floor
        console.log('Floor drawn.');

        // Grid Background
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x646cff, 0.2);
        for (let i = 0; i < 800; i += 40) {
            graphics.moveTo(i, 0);
            graphics.lineTo(i, 600);
        }
        for (let j = 0; j < 600; j += 40) {
            graphics.moveTo(0, j);
            graphics.lineTo(800, j);
        }
        graphics.strokePath();

        // Listener: Initial Players
        this.socket.on('currentPlayers', (players: any) => {
            console.log('Syncing current players:', players);
            Object.keys(players).forEach((id) => {
                if (id === this.socket?.id) {
                    this.addPlayer(players[id]);
                } else {
                    this.addOtherPlayers(players[id]);
                }
            });
        });

        // Listener: New Player
        this.socket.on('newPlayer', (playerInfo: any) => {
            this.addOtherPlayers(playerInfo);
        });

        // NOW Join Room once listeners are ready
        this.socket.emit('joinRoom', {
            room: 'main-space',
            name: this.userData?.name || this.userData?.nickname || 'Explorer',
            picture: this.userData?.picture || '',
            userId: this.userData?.sub, // Auth0 Unique ID
            email: this.userData?.email
        });

        this.socket.on('profileUpdated', (playerInfo: any) => {
            console.log('Profile updated for:', playerInfo.id);
            if (playerInfo.id === this.socket?.id) {
                if (this.playerNameText) this.playerNameText.setText(playerInfo.name);
                this.updateAvatarImage(this.player!, playerInfo.picture, playerInfo.id);
            } else {
                this.otherPlayers.getChildren().forEach((other: any) => {
                    if ((other as any).playerId === playerInfo.id) {
                        const nameText = this.otherPlayerNames.get(playerInfo.id);
                        if (nameText) nameText.setText(playerInfo.name);
                        this.updateAvatarImage(other as Phaser.GameObjects.Sprite, playerInfo.picture, playerInfo.id);
                    }
                });
            }
        });

        // Other Listeners...
        this.socket.on('playerMoved', (playerInfo: any) => {
            this.otherPlayers.getChildren().forEach((otherPlayer: any) => {
                if (playerInfo.id === otherPlayer.playerId) {
                    // Smoothly move other player to the new tile
                    this.tweens.add({
                        targets: otherPlayer,
                        x: playerInfo.x,
                        y: playerInfo.y,
                        duration: 150,
                        ease: 'Power2',
                        onUpdate: () => {
                            const nameText = this.otherPlayerNames.get(playerInfo.id);
                            if (nameText) {
                                nameText.setPosition(otherPlayer.x, otherPlayer.y - 30);
                            }
                        }
                    });
                }
            });
        });

        this.socket.on('playerDisconnected', (playerId: string) => {
            this.otherPlayers.getChildren().forEach((otherPlayer: any) => {
                if (playerId === (otherPlayer as any).playerId) {
                    otherPlayer.destroy();
                    const nameText = this.otherPlayerNames.get(playerId);
                    if (nameText) {
                        nameText.destroy();
                        this.otherPlayerNames.delete(playerId);
                    }
                }
            });
        });

        this.cursors = this.input.keyboard?.createCursorKeys();
    }

    update() {
        if (this.player && this.cursors) {
            const currentTime = this.time.now;

            // Check if enough time has passed since the last move
            if (currentTime - this.lastMoveTime > this.moveInterval) {
                let moved = false;
                let newX = this.player.x;
                let newY = this.player.y;

                if (this.cursors.left.isDown) {
                    newX -= this.tileSize;
                    moved = true;
                } else if (this.cursors.right.isDown) {
                    newX += this.tileSize;
                    moved = true;
                } else if (this.cursors.up.isDown) {
                    newY -= this.tileSize;
                    moved = true;
                } else if (this.cursors.down.isDown) {
                    newY += this.tileSize;
                    moved = true;
                }

                if (moved) {
                    // Constrain to grid boundaries (keeping within 800x600)
                    newX = Phaser.Math.Clamp(newX, 20, 780);
                    newY = Phaser.Math.Clamp(newY, 20, 580);

                    if (newX !== this.player.x || newY !== this.player.y) {
                        this.lastMoveTime = currentTime;

                        // Smoothly tween to the next tile
                        this.tweens.add({
                            targets: this.player,
                            x: newX,
                            y: newY,
                            duration: 150,
                            ease: 'Power2',
                            onUpdate: () => {
                                // Update name text position during movement
                                if (this.playerNameText) {
                                    this.playerNameText.setPosition(this.player!.x, this.player!.y - 30);
                                }
                            }
                        });

                        this.socket?.emit('playerMovement', { x: newX, y: newY });
                    }
                }
            }

            // Proximity Logic (always running)
            this.otherPlayers.getChildren().forEach((other: any) => {
                const distance = Phaser.Math.Distance.Between(
                    this.player!.x,
                    this.player!.y,
                    other.x,
                    other.y
                );

                const nameText = this.otherPlayerNames.get(other.playerId);

                if (distance < this.interactionRadius) {
                    other.setAlpha(1);
                    if (nameText) nameText.setAlpha(1);
                } else {
                    other.setAlpha(0.2);
                    if (nameText) nameText.setAlpha(0.2);
                }
            });
        }
    }

    addPlayer(playerInfo: any) {
        // USE GATHER ICON AS PLAYER
        const sprite = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'playerIcon');
        sprite.setDisplaySize(40, 40);
        this.player = sprite;
        this.player.setCollideWorldBounds(true);

        this.playerNameText = this.add.text(playerInfo.x, playerInfo.y - 30, playerInfo.name, {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5);

        if (playerInfo.picture) {
            this.updateAvatarImage(sprite, playerInfo.picture, playerInfo.id);
        }
    }

    addOtherPlayers(playerInfo: any) {
        const sprite = this.add.sprite(playerInfo.x, playerInfo.y, 'playerIcon');
        sprite.setDisplaySize(40, 40);
        sprite.setTint(0xcccccc); // Slightly darker for other players
        (sprite as any).playerId = playerInfo.id;
        this.otherPlayers.add(sprite);

        const nameText = this.add.text(playerInfo.x, playerInfo.y - 30, playerInfo.name, {
            fontSize: '14px',
            color: '#646cff',
            backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5);

        this.otherPlayerNames.set(playerInfo.id, nameText);

        if (playerInfo.picture) {
            this.updateAvatarImage(sprite, playerInfo.picture, playerInfo.id);
        }
    }

    private updateAvatarImage(sprite: Phaser.GameObjects.Sprite, url: string, id: string) {
        if (!url || (!url.startsWith('http') && !url.startsWith('data:image'))) return;

        // Generate a stable key for the texture
        const key = url.startsWith('data:')
            ? `avatar_base64_${id}_${url.length}`
            : `avatar_${id}_${url.substring(url.lastIndexOf('/') + 1)}`;

        if (this.textures.exists(key)) {
            sprite.setTexture(key);
            sprite.setDisplaySize(40, 40);
            sprite.clearTint();
        } else {
            this.load.image(key, url);
            this.load.once(`complete`, () => {
                if (sprite.active) {
                    sprite.setTexture(key);
                    sprite.setDisplaySize(40, 40);
                    sprite.clearTint();
                }
            });
            this.load.start();
        }
    }
}
