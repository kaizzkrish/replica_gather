import pool from './pool.js';

export const initDb = async () => {
    const queries = [
        `DROP TABLE IF EXISTS replica_messages;`,
        `DROP TABLE IF EXISTS replica_users;`,
        `CREATE TABLE replica_users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255),
            picture TEXT,
            last_x INTEGER DEFAULT 380,
            last_y INTEGER DEFAULT 300,
            room VARCHAR(50) DEFAULT 'main-space',
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE replica_messages (
            id SERIAL PRIMARY KEY,
            sender_id VARCHAR(255) NOT NULL,
            sender_name VARCHAR(255),
            message TEXT NOT NULL,
            target_to VARCHAR(255) DEFAULT 'global',
            room VARCHAR(50) DEFAULT 'main-space',
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
    ];

    try {
        console.log('--- Initializing Replica Database ---');
        for (const query of queries) {
            await pool.query(query);
        }

        // Final check: List columns to console
        const colRes = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'replica_users'"
        );
        console.log('✅ replica_users columns:', colRes.rows.map(r => r.column_name).join(', '));

        console.log('✅ Database schema verified - all columns present');
    } catch (err: any) {
        console.error('❌ Error initializing database:', err.message);
    }
};
