// Routen für Chat-Verlauf (Konversationen und Nachrichten)
const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');

const router = express.Router();

// Alle Routen hier sind nur für eingeloggte User
router.use(auth);

// GET /api/conversations – Alle Gespräche des Users laden
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fehler beim Laden der Gespräche:', err.message);
        res.status(500).json({ error: 'Fehler beim Laden der Gespräche' });
    }
});

// POST /api/conversations – Neues Gespräch starten
router.post('/', async (req, res) => {
    const { title } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
            [req.user.userId, title || 'Neues Gespräch']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Fehler beim Erstellen des Gesprächs:', err.message);
        res.status(500).json({ error: 'Fehler beim Erstellen des Gesprächs' });
    }
});

// GET /api/conversations/:id/messages – Nachrichten eines Gesprächs laden
router.get('/:id/messages', async (req, res) => {
    try {
        // Sicherheitsprüfung: Gespräch gehört dem eingeloggten User?
        const conv = await db.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Gespräch nicht gefunden' });
        }

        const messages = await db.query(
            'SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json(messages.rows);
    } catch (err) {
        console.error('Fehler beim Laden der Nachrichten:', err.message);
        res.status(500).json({ error: 'Fehler beim Laden der Nachrichten' });
    }
});

// DELETE /api/conversations/:id – Gespräch löschen
router.delete('/:id', async (req, res) => {
    try {
        await db.query(
            'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Fehler beim Löschen:', err.message);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

module.exports = router;
