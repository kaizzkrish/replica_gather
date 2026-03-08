import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/replica_gather'
});

async function check() {
    try {
        const res = await pool.query('SELECT COUNT(*) FROM replica_messages');
        console.log('Total messages:', res.rows[0].count);
        const last = await pool.query('SELECT * FROM replica_messages ORDER BY created_at DESC LIMIT 5');
        console.log('Last 5 messages:', last.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
