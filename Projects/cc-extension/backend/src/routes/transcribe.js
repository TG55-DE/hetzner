// Transkriptions-Route
// Empfängt eine Audiodatei und sendet sie an die OpenAI Whisper API
const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const auth = require('../middleware/auth');

const router = express.Router();

// Multer: Audiodatei im Speicher halten (kein Disk-Schreiben)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // Max 25 MB (Whisper-Limit)
});

// OpenAI-Client initialisieren
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Alle Routen nur für eingeloggte Nutzer
router.use(auth);

// POST /api/transcribe – Audiodatei transkribieren
router.post('/', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Keine Audiodatei empfangen' });
    }

    try {
        // Dateiname mit Endung bestimmen (Whisper braucht eine Endung)
        // MediaRecorder liefert meist audio/webm oder audio/ogg
        const mimeType = req.file.mimetype || 'audio/webm';
        let extension = 'webm';
        if (mimeType.includes('ogg'))  extension = 'ogg';
        if (mimeType.includes('mp4'))  extension = 'mp4';
        if (mimeType.includes('mp3') || mimeType.includes('mpeg')) extension = 'mp3';
        if (mimeType.includes('wav'))  extension = 'wav';

        // Buffer als File-Objekt verpacken (OpenAI SDK erwartet ein File-Objekt)
        const audioFile = new File(
            [req.file.buffer],
            `aufnahme.${extension}`,
            { type: mimeType }
        );

        // Whisper API aufrufen
        const transkription = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: audioFile,
            language: 'de', // Deutsch bevorzugen
        });

        res.json({ text: transkription.text });
    } catch (err) {
        console.error('[Whisper] Fehler:', err);
        res.status(500).json({ error: 'Transkription fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler') });
    }
});

module.exports = router;
