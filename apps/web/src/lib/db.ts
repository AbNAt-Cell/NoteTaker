import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://abba:chickenrepublic@31.97.145.11:5432/amebodb',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function ensureProfile(userId: string, email: string, fullName?: string) {
    const res = await query('SELECT id FROM profiles WHERE id = $1', [userId]);
    if (res.rowCount === 0) {
        await query(
            'INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)',
            [userId, email, fullName || '']
        );
    }
}

export default pool;
