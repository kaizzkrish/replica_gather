import pool from './pool.js';

export const initDb = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS picture TEXT;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_x INTEGER DEFAULT 380;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_y INTEGER DEFAULT 300;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS room VARCHAR(50) DEFAULT 'main-space';`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`
    ];

    try {
        for (const query of queries) {
            console.log(`Running DB query: ${query.substring(0, 50)}...`);
            await pool.query(query);
        }

        // Final check: List columns to console
        const colRes = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
        );
        console.log('✅ Users table columns:', colRes.rows.map(r => r.column_name).join(', '));

        console.log('✅ Database schema verified - all columns present');
    } catch (err: any) {
        console.error('❌ Error initializing database:', err.message);
    }
};
