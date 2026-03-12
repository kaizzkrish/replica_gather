import Phaser from 'phaser';


export const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [],
    parent: 'game-container',
    backgroundColor: '#f5f5dc'
};
