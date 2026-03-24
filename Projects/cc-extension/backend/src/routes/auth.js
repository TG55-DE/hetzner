// Auth-Routen: Registrierung und Login
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db');

const router = express.Router();

// POST /api/auth/register – Neuen User anlegen
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    // Eingaben prüfen
    if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
    }

    try {
        // Prüfen ob E-Mail schon vergeben
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'E-Mail bereits registriert' });
        }

        // Passwort hashen (10 = Sicherheitsstufe)
        const passwordHash = await bcrypt.hash(password, 10);

        // User in Datenbank speichern
        const result = await db.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, passwordHash]
        );

        // JWT-Token erstellen (bleibt 30 Tage gültig)
        const token = jwt.sign(
            { userId: result.rows[0].id, email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({ token, email });
    } catch (err) {
        console.error('Registrierungsfehler:', err.message);
        res.status(500).json({ error: 'Server-Fehler bei der Registrierung' });
    }
});

// POST /api/auth/login – Einloggen
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }

    try {
        // User in Datenbank suchen
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
        }

        const user = result.rows[0];

        // Passwort prüfen
        const passwordOk = await bcrypt.compare(password, user.password_hash);
        if (!passwordOk) {
            return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
        }

        // Neues JWT-Token ausstellen
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ token, email: user.email });
    } catch (err) {
        console.error('Login-Fehler:', err.message);
        res.status(500).json({ error: 'Server-Fehler beim Login' });
    }
});

module.exports = router;
