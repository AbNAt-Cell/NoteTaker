import { Pool } from 'pg';

const pool = new Pool({
    connectionString: 'postgresql://abba:chickenrepublic@31.97.145.11:5432/amebodb',
    ssl: false // Adjust if needed
});

async function init() {
    console.log('--- Initializing NoteTaker Schema in External Postgres ---');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Extensions
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // 2. Profiles Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        role TEXT DEFAULT 'member',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // 3. Organizations Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        subscription_plan TEXT DEFAULT 'free',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // 4. Meetings Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        title TEXT DEFAULT 'Untitled Meeting',
        audio_url TEXT,
        transcript_status TEXT DEFAULT 'pending',
        scheduled_at TIMESTAMPTZ DEFAULT NOW(),
        duration_minutes INTEGER DEFAULT 0,
        tags TEXT[] DEFAULT '{}',
        summary TEXT DEFAULT '',
        speakers TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // 5. Transcripts Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
        raw_text TEXT DEFAULT '',
        cleaned_text TEXT DEFAULT '',
        summary TEXT DEFAULT '',
        action_items JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // 6. Calendar Connections
        await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_connections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        calendar_email TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        await client.query('COMMIT');
        console.log('Schema initialized successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Initialization failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

init();
