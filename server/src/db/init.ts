import pool from './pool.js';

export const initDb = async () => {
    const tableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255),
            picture TEXT,
            last_x INTEGER DEFAULT 380,
            last_y INTEGER DEFAULT 300,
            room VARCHAR(50) DEFAULT 'main-space',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await pool.query(tableQuery);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};
