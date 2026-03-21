import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { config } from '../game/GameConfig';
import GameScene from '../game/GameScene';
import { Socket } from 'socket.io-client';

interface GameProps {
    socket: Socket | null;
    user: any;
}

const Game: React.FC<GameProps> = ({ socket, user }) => {
    const gameRef = useRef<Phaser.Game | null>(null);

    useEffect(() => {
        if (!gameRef.current && socket && user) {
            console.log('Initializing Phaser Game with user:', user.name);
            const game = new Phaser.Game(config);
            gameRef.current = game;

            game.events.once('ready', () => {
                console.log('Game ready, adding Scene...');
                game.scene.add('GameScene', GameScene, true, { socket, user });
            });
        }

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, [socket]);

    return (
        <div id="game-container" style={{ width: '100%', height: '100%' }} />
    );
};

export default Game;
