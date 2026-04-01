'use strict';

// ============================================================
// SOCKET.IO CLIENT – Verbindung zum Server, State-Empfang
// ============================================================

class BombermanClient {
  constructor(game) {
    this.game     = game;     // Referenz auf BombermanGame
    this.socket   = null;
    this.roomCode = null;
    this.myId     = null;
    this.isHost   = false;
    this._connected = false;
  }

  connect() {
    this.socket = io({ transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this.myId      = this.socket.id;
      this._connected = true;
      console.log('[Client] Verbunden, ID:', this.myId);

      // Auto-Join: URL enthält /join/CODE?
      const m = window.location.pathname.match(/\/join\/([A-Z]{4})/i);
      if (m) {
        this.joinRoom(m[1].toUpperCase());
        // URL bereinigen ohne Reload
        history.replaceState({}, '', '/');
      }
    });

    this.socket.on('disconnect', () => {
      this._connected = false;
      console.log('[Client] Verbindung getrennt');
    });

    // ── Raum-Events ──────────────────────────────────────────
    this.socket.on('room_created', ({ code }) => {
      this.roomCode = code;
      this.isHost   = true;
      this.game.onRoomCreated(code);
    });

    this.socket.on('room_joined', ({ code }) => {
      this.roomCode = code;
      this.isHost   = false;
      this.game.onRoomJoined(code);
    });

    this.socket.on('join_error', (msg) => {
      this.game.onJoinError(msg);
    });

    this.socket.on('lobby_state', (state) => {
      this.game.onLobbyState(state);
    });

    this.socket.on('game_started', () => {
      this.game.onGameStarted();
    });

    this.socket.on('player_left', ({ id }) => {
      this.game.onPlayerLeft(id);
    });

    // ── Game-State vom Server ────────────────────────────────
    this.socket.on('game_state', (state) => {
      this.game.applyServerState(state);
    });

    // ── Audio-Events ─────────────────────────────────────────
    this.socket.on('play_audio', (snd) => {
      this.game.audio.play(snd);
    });
  }

  // ── Aktionen ──────────────────────────────────────────────

  createRoom(settings) {
    if (!this._connected) return;
    this.socket.emit('create_room', settings);
  }

  joinRoom(code) {
    if (!this._connected) return;
    this.socket.emit('join_room', { code });
  }

  startGame() {
    if (!this._connected || !this.isHost) return;
    this.socket.emit('start_game');
  }

  updateSettings(settings) {
    if (!this._connected || !this.isHost) return;
    this.socket.emit('update_settings', settings);
  }

  // Wird aus dem Input-Manager pro Frame aufgerufen
  sendInput(dir, bomb) {
    if (!this._connected || !this.roomCode) return;
    this.socket.emit('input', { dir, bomb });
  }
}
