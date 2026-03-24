#!/bin/bash
# add-user.sh – Neuen User für die CC Extension anlegen
# Verwendung: ./add-user.sh <email> <passwort>
# Beispiel:   ./add-user.sh max@example.com meinPasswort123

set -e

# Skript muss im Projektverzeichnis ausgeführt werden
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Argumente prüfen
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Verwendung: $0 <email> <passwort>"
    echo "Beispiel:   $0 timo@example.com meinPasswort123"
    exit 1
fi

EMAIL="$1"
PASSWORT="$2"

# Passwort-Länge prüfen (mindestens 8 Zeichen)
if [ ${#PASSWORT} -lt 8 ]; then
    echo "Fehler: Passwort muss mindestens 8 Zeichen lang sein."
    exit 1
fi

echo "Lege User an: $EMAIL"

# Node.js-Script zum Anlegen des Users
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const email = '$EMAIL';
    const passwort = '$PASSWORT';

    // Prüfen ob User schon existiert
    const vorhanden = await db.query('SELECT id FROM users WHERE email = \$1', [email]);
    if (vorhanden.rows.length > 0) {
        console.error('Fehler: User ' + email + ' existiert bereits.');
        process.exit(1);
    }

    // Passwort hashen (10 Runden)
    const hash = await bcrypt.hash(passwort, 10);

    // User in Datenbank eintragen
    await db.query('INSERT INTO users (email, password_hash) VALUES (\$1, \$2)', [email, hash]);

    console.log('✅ User ' + email + ' erfolgreich angelegt.');
    await db.end();
}

main().catch(err => {
    console.error('Fehler:', err.message);
    process.exit(1);
});
"

echo "Fertig! User kann sich jetzt unter https://91.99.56.96 einloggen."
