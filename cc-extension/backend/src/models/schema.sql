-- CC Extension Datenbank-Schema

-- Tabelle: Benutzer (für Login)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt gehashtes Passwort
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabelle: Chat-Konversationen
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Neues Gespräch',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabelle: Einzelne Chat-Nachrichten
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant', oder 'system'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabelle: Port-Registry (welche App läuft auf welchem Port)
CREATE TABLE IF NOT EXISTS deployed_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    app_name VARCHAR(100) UNIQUE NOT NULL,    -- z.B. "todo-liste"
    port INTEGER UNIQUE NOT NULL,             -- z.B. 3001
    status VARCHAR(20) DEFAULT 'running',     -- 'running', 'stopped', 'failed'
    conversation_id UUID REFERENCES conversations(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_deployed_apps_port ON deployed_apps(port);
