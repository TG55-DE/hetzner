// Datenbankverbindung über den pg-Pool
// Ein "Pool" verwaltet mehrere Verbindungen gleichzeitig – effizienter als jedes Mal neu verbinden
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Verbindung beim Start testen
pool.connect((err, client, release) => {
    if (err) {
        console.error('Datenbankverbindung fehlgeschlagen:', err.message);
    } else {
        console.log('Datenbankverbindung erfolgreich');
        release();
    }
});

module.exports = pool;
