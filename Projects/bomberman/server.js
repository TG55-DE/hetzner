'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const QRCode     = require('qrcode');

const roomManager = require('./server/roomManager');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

const PORT = process.env.PORT || 3003;
const HOST = '127.0.0.1';
const PUBLIC_BASE = process.env.PUBLIC_BASE || 'https://91.99.56.96:10443';

// ── Statische Dateien ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// ── QR-Code API ───────────────────────────────────────────────
app.get('/api/qr/:code', async (req, res) => {
  try {
    const url = `${PUBLIC_BASE}/join/${req.params.code}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: '#ffd740', light: '#0d0a22' },
    });
    res.json({ dataUrl, url });
  } catch (e) {
    res.status(500).json({ error: 'QR-Code Fehler' });
  }
});

// ── Fallback: immer index.html (für /join/:code PWA-Routing) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Socket.io Events ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Verbunden: ${socket.id}`);

  // ── Raum erstellen ────────────────────────────────────────
  socket.on('create_room', (settings = {}) => {
    const room = roomManager.createRoom(socket.id, settings);

    // Broadcast-Callback registrieren
    room.onBroadcast = (snap) => {
      io.to(room.code).emit('game_state', snap);
    };
    room.onAudio = (code, snd) => {
      io.to(code).emit('play_audio', snd);
    };

    socket.join(room.code);
    socket.emit('room_created', { code: room.code });
    socket.emit('lobby_state', room.getLobbySnapshot());

    console.log(`[Room] ${room.code} erstellt von ${socket.id}`);

    // Solo-Modus: Spiel sofort starten
    if (settings.solo) {
      room.startGame();
      socket.emit('game_started');
    }
  });

  // ── Raum beitreten ────────────────────────────────────────
  socket.on('join_room', ({ code }) => {
    const result = roomManager.joinRoom(code, socket.id);
    if (result.error) {
      socket.emit('join_error', result.error);
      return;
    }

    const { room } = result;
    socket.join(room.code);

    // Broadcast-Callback sicherstellen
    if (!room.onBroadcast) {
      room.onBroadcast = (snap) => io.to(room.code).emit('game_state', snap);
      room.onAudio     = (c, snd) => io.to(c).emit('play_audio', snd);
    }

    socket.emit('room_joined', { code: room.code });
    io.to(room.code).emit('lobby_state', room.getLobbySnapshot());

    console.log(`[Room] ${socket.id} ist ${room.code} beigetreten`);
  });

  // ── Spiel starten (nur Host) ──────────────────────────────
  socket.on('start_game', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.phase !== 'lobby') return;

    room.startGame();
    io.to(room.code).emit('game_started');
    console.log(`[Room] ${room.code} gestartet`);
  });

  // ── Spieler-Input ─────────────────────────────────────────
  socket.on('input', ({ dir, bomb }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.phase !== 'play') return;

    const player = room.players[socket.id];
    if (!player) return;

    player.input.up    = dir === 'up';
    player.input.down  = dir === 'down';
    player.input.left  = dir === 'left';
    player.input.right = dir === 'right';
    player.input.bomb  = !!bomb;
  });

  // ── Einstellungen ändern (nur Host, nur in Lobby) ─────────
  socket.on('update_settings', (settings) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    Object.assign(room.settings, settings);
    room.worldIdx = room.settings.worldIdx || 0;
    io.to(room.code).emit('lobby_state', room.getLobbySnapshot());
  });

  // ── Verbindung getrennt ───────────────────────────────────
  socket.on('disconnect', () => {
    const room = roomManager.removePlayer(socket.id);
    if (room && room.playerCount() > 0) {
      if (room.phase === 'lobby') {
        io.to(room.code).emit('lobby_state', room.getLobbySnapshot());
      } else {
        io.to(room.code).emit('player_left', { id: socket.id });
      }
    }
    console.log(`[Socket] Getrennt: ${socket.id}`);
  });
});

// ── Server starten ────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`Bomberman-Server läuft auf http://${HOST}:${PORT}`);
});
