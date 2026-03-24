// Express-Server für die Meditation App mit JWT-Authentifizierung
// override: true damit .env-Werte Shell-Umgebungsvariablen überschreiben
require('dotenv').config({ override: true });

const express      = require('express');
const path         = require('path');
const { Pool }     = require('pg');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcrypt');
const cookieParser = require('cookie-parser');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Datenbankverbindung ──────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Verbindung beim Start prüfen und Tabelle anlegen falls nötig
pool.connect()
  .then(async client => {
    console.log('Datenbankverbindung erfolgreich');
    // Einstellungs-Tabelle anlegen (einmalig, falls noch nicht vorhanden)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        duration_minutes INTEGER DEFAULT 30,
        zwischengong_min INTEGER DEFAULT 15,
        vorlauf_seconds  INTEGER DEFAULT 10,
        selected_gong    TEXT    DEFAULT 'deep',
        updated_at       TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Tabelle user_settings bereit');
    // Meditations-Sessions-Tabelle anlegen
    await client.query(`
      CREATE TABLE IF NOT EXISTS meditation_sessions (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        planned_minutes  INTEGER NOT NULL,
        actual_minutes   INTEGER NOT NULL,
        completed        BOOLEAN NOT NULL DEFAULT false
      )
    `);
    console.log('Tabelle meditation_sessions bereit');
    client.release();
  })
  .catch(err => {
    console.error('Datenbankverbindung fehlgeschlagen:', err.message);
  });

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ── JWT-Verifizierungs-Middleware ────────────────────────────────────────────
function authMiddleware(req, res, next) {
  // Token aus Cookie oder Authorization-Header lesen
  const cookieToken = req.cookies.token;
  const headerToken = req.headers.authorization?.replace('Bearer ', '');
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token' });
  }
}

// ── Auth-Routen (ungeschützt) ────────────────────────────────────────────────

// POST /api/auth/login — Email + Passwort prüfen, JWT zurückgeben
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email und Passwort sind erforderlich' });
  }

  try {
    // Benutzer in der Datenbank suchen
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    // Gleiche Fehlermeldung für "nicht gefunden" und "falsches Passwort"
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const passwortKorrekt = await bcrypt.compare(password, user.password_hash);
    if (!passwortKorrekt) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // JWT erstellen (gültig für 7 Tage)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Token als HttpOnly-Cookie setzen (zusätzlich zum JSON-Response)
    res.cookie('token', token, {
      httpOnly: true,
      secure:   true,  // Nur über HTTPS übertragen
      maxAge:   7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      token,
      user: { id: user.id, email: user.email }
    });

  } catch (err) {
    console.error('Login-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler beim Login' });
  }
});

// ── Geschützte Auth-Routen ───────────────────────────────────────────────────

// GET /api/auth/verify — Token-Gültigkeit prüfen
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// POST /api/auth/logout — Cookie löschen
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ── Einstellungs-Routen (geschützt) ─────────────────────────────────────────

// GET /api/settings — Einstellungen des eingeloggten Nutzers laden
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT duration_minutes, zwischengong_min, vorlauf_seconds, selected_gong FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      // Noch keine Einstellungen gespeichert → Standardwerte zurückgeben
      return res.json({ duration_minutes: 30, zwischengong_min: 15, vorlauf_seconds: 10, selected_gong: 'deep' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fehler beim Laden der Einstellungen:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/settings — Einstellungen speichern (Upsert)
app.put('/api/settings', authMiddleware, async (req, res) => {
  const { duration_minutes, zwischengong_min, vorlauf_seconds, selected_gong } = req.body;
  try {
    await pool.query(`
      INSERT INTO user_settings (user_id, duration_minutes, zwischengong_min, vorlauf_seconds, selected_gong, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        duration_minutes = EXCLUDED.duration_minutes,
        zwischengong_min = EXCLUDED.zwischengong_min,
        vorlauf_seconds  = EXCLUDED.vorlauf_seconds,
        selected_gong    = EXCLUDED.selected_gong,
        updated_at       = NOW()
    `, [req.user.id, duration_minutes, zwischengong_min, vorlauf_seconds, selected_gong]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Fehler beim Speichern der Einstellungen:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Sessions-Routen (geschützt) ──────────────────────────────────────────────

// GET /api/sessions — alle Sessions des eingeloggten Nutzers laden
app.get('/api/sessions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, started_at, planned_minutes, actual_minutes, completed FROM meditation_sessions WHERE user_id = $1 ORDER BY started_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden der Sessions:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/sessions — neue Session speichern
app.post('/api/sessions', authMiddleware, async (req, res) => {
  const { planned_minutes, actual_minutes, completed } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO meditation_sessions (user_id, planned_minutes, actual_minutes, completed) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, planned_minutes, actual_minutes, completed || false]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Fehler beim Speichern der Session:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/sessions/:id — Session löschen
app.delete('/api/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM meditation_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Fehler beim Löschen der Session:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ── Statische Dateien ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── SPA-Fallback: Alle anderen Routen → index.html ──────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Server starten ───────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Meditation App läuft auf http://91.99.56.96:${PORT}`);
});
