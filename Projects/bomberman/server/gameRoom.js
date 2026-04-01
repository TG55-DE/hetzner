'use strict';

// ============================================================
// GAME ROOM – Verwaltet einen Spielraum (Zustand + Spielschleife)
// ============================================================
const {
  S_LOBBY, S_PLAY, S_CLEAR, S_OVER, S_WIN,
  BOMB_FUSE, EXPL_DUR, TICK_DT,
  PU_BOMB, PU_RANGE, PU_SPEED,
  WORLD_ENEMIES, COLLECTIBLE_MAP, SPEED_MAP,
  PLAYER_STARTS,
} = require('./constants');

const {
  generateMap,
  canMove,
  tileX,
  tileY,
  updatePlayer,
  updateEnemy,
  explodeBomb,
  checkCollisions,
  createPlayerState,
  createEnemyState,
  getEnemySpots,
} = require('./gameLogic');

class GameRoom {
  constructor(code, hostId, settings = {}) {
    this.code     = code;
    this.hostId   = hostId;
    this.settings = Object.assign({
      worldIdx:     0,
      speed:        'normal',
      collectibles: 'normal',
    }, settings);

    // Spielzustand
    this.phase      = S_LOBBY;
    this.map        = generateMap();
    this.players    = {};   // { socketId: playerState }
    this.enemies    = [];
    this.bombs      = [];
    this.explosions = [];
    this.powerups   = [];
    this.scores     = {};   // { socketId: number }
    this.worldIdx   = this.settings.worldIdx;
    this.clearTimer = 0;

    // Broadcast-Callback (wird von roomManager gesetzt)
    this.onBroadcast = null;
    this.onAudio     = null;

    // Tick-Schleife
    this._tickInterval = null;
    this._time         = 0;
    this._mapDirty     = true; // Map beim ersten Tick immer senden
  }

  // ── Spieler ──────────────────────────────────────────────

  addPlayer(socketId) {
    const usedSlots = Object.values(this.players).map(p => p.slot);
    const slot = [0, 1, 2, 3].find(s => !usedSlots.includes(s));
    if (slot === undefined) return null; // Raum voll

    const ps = createPlayerState(socketId, slot);
    this.players[socketId] = ps;
    this.scores[socketId]  = 0;
    return ps;
  }

  removePlayer(socketId) {
    delete this.players[socketId];
    delete this.scores[socketId];
    // Wenn Host geht: nächsten Spieler zum Host machen
    if (socketId === this.hostId) {
      const ids = Object.keys(this.players);
      if (ids.length > 0) this.hostId = ids[0];
    }
  }

  playerCount() {
    return Object.keys(this.players).length;
  }

  // ── Spiel starten ─────────────────────────────────────────

  startGame() {
    this._loadWorld(this.worldIdx);
    this.phase = S_PLAY;
    this._startTick();
  }

  _loadWorld(idx) {
    this.worldIdx   = idx;
    this.map        = generateMap();
    this.bombs      = [];
    this.explosions = [];
    this.powerups   = [];
    this._mapDirty  = true;
    this._time      = 0;

    // Spieler zurücksetzen
    for (const p of Object.values(this.players)) {
      const start = PLAYER_STARTS[p.slot];
      p.px = start.x * 30; // TILE
      p.py = start.y * 30;
      p.gridX = p.targetX = start.x;
      p.gridY = p.targetY = start.y;
      p.lives    = 3;
      p.invTimer = 0;
      p.alive    = true;
      p.bombsOut = 0;
      p.maxBombs = 1;
      p.range    = 2;
      p.speed    = SPEED_MAP[this.settings.speed] || 3.2;
      p._bombConsumed = false;
      this.scores[p.id] = this.scores[p.id] || 0;
    }

    // KI-Gegner spawnen (Lücken auf 4 Slots auffüllen)
    const humanSlots = Object.values(this.players).map(p => p.slot);
    const aiCount    = WORLD_ENEMIES[idx] || 3;
    const spots      = getEnemySpots();
    this.enemies = [];
    for (let i = 0; i < aiCount; i++) {
      const [gx, gy] = spots[i % spots.length];
      if (this.map[gy][gx] === 2) this.map[gy][gx] = 0; // T_BRICK → T_EMPTY
      this.enemies.push(createEnemyState(`ai_${i}`, gx, gy));
    }
  }

  // ── Tick-Schleife ─────────────────────────────────────────

  _startTick() {
    this._tickInterval = setInterval(() => this._tick(), 1000 / 20); // 20 TPS
  }

  stopTick() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  _tick() {
    if (this.phase !== S_PLAY) {
      if (this.phase === S_CLEAR) {
        this.clearTimer -= TICK_DT;
        if (this.clearTimer <= 0) this._nextWorld();
      }
      this._broadcast();
      return;
    }

    const dt = TICK_DT;
    this._time += dt;

    const powerupChance = COLLECTIBLE_MAP[this.settings.collectibles] || 0.30;

    // Spieler updaten
    const bombsToPlace = [];
    for (const p of Object.values(this.players)) {
      const action = updatePlayer(p, dt, p.input, this.map, this.bombs);
      if (action === 'bomb' && p.bombsOut < p.maxBombs) {
        bombsToPlace.push({ gx: p.gridX, gy: p.gridY, range: p.range, ownerId: p.id });
        p.bombsOut++;
      }
    }

    // KI-Gegner updaten
    for (const e of this.enemies) {
      updateEnemy(e, dt, this.map, this.bombs, this.explosions, Object.values(this.players));
    }

    // Neue Bomben registrieren
    for (const b of bombsToPlace) {
      this.bombs.push({ ...b, timer: BOMB_FUSE });
      if (this.onAudio) this.onAudio(this.code, 'bomb_place');
    }

    // Bomben-Timer
    for (const b of [...this.bombs]) {
      b.timer -= dt;
      if (b.timer <= 0) this._explodeBomb(b, powerupChance);
    }

    // Explosions-Timer
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].timer -= dt;
      if (this.explosions[i].timer <= 0) this.explosions.splice(i, 1);
    }

    // Kollisionen
    const events = checkCollisions(
      Object.values(this.players), this.enemies,
      this.explosions, this.powerups, this.scores
    );

    for (const ev of events) {
      if (ev.type === 'player_hit')  this._handlePlayerHit(ev.id);
      if (ev.type === 'enemy_killed') this._handleEnemyKilled(ev.id);
      if (ev.type === 'powerup')     this._handlePowerup(ev.id, ev.puType);
    }

    // Sieg: alle Feinde tot?
    const allEnemiesDead = this.enemies.every(e => !e.alive);
    const anyPlayerAlive = Object.values(this.players).some(p => p.alive);
    if (anyPlayerAlive && allEnemiesDead) {
      for (const p of Object.values(this.players)) {
        if (p.alive) this.scores[p.id] = (this.scores[p.id] || 0) + 500;
      }
      this.phase      = S_CLEAR;
      this.clearTimer = 4.0; // 4 Sekunden bis nächste Welt
      if (this.onAudio) this.onAudio(this.code, 'level_clear');
    }

    this._broadcast();
  }

  _explodeBomb(bomb, powerupChance) {
    const idx = this.bombs.indexOf(bomb);
    if (idx === -1) return;
    this.bombs.splice(idx, 1);

    // Bombsout beim Besitzer reduzieren
    const owner = this.players[bomb.ownerId];
    if (owner) owner.bombsOut = Math.max(0, owner.bombsOut - 1);

    const { tiles, bricks } = explodeBomb(bomb, this.map, this.powerups, powerupChance);
    this.explosions.push({ tiles, timer: EXPL_DUR, cx: bomb.gx, cy: bomb.gy });
    this._mapDirty = true; // Map hat sich verändert (Bricks abgerissen)

    if (this.onAudio) this.onAudio(this.code, 'explosion');
    if (bricks.length > 0 && this.onAudio) this.onAudio(this.code, 'brick_break');

    // Kettenreaktion
    const tileSet = new Set(tiles.map(t => `${t.x},${t.y}`));
    for (const other of [...this.bombs]) {
      if (tileSet.has(`${other.gx},${other.gy}`)) {
        this._explodeBomb(other, powerupChance);
      }
    }
  }

  _handlePlayerHit(socketId) {
    const p = this.players[socketId];
    if (!p || !p.alive || p.invTimer > 0) return;
    p.invTimer = 2.5; // INVINCIBLE
    p.lives--;
    if (this.onAudio) this.onAudio(this.code, 'player_die');

    if (p.lives <= 0) {
      p.alive = false;
      // Alle tot?
      if (Object.values(this.players).every(pl => !pl.alive)) {
        this.phase = S_OVER;
        if (this.onAudio) this.onAudio(this.code, 'game_over');
      }
    } else {
      // Spieler zurück zum Start
      const start = PLAYER_STARTS[p.slot];
      p.gridX = p.targetX = start.x;
      p.gridY = p.targetY = start.y;
      p.px = start.x * 30;
      p.py = start.y * 30;
    }
  }

  _handleEnemyKilled(enemyId) {
    const e = this.enemies.find(en => en.id === enemyId);
    if (e) e.alive = false;
    // Punkte an alle lebenden Spieler verteilen
    for (const p of Object.values(this.players)) {
      if (p.alive) this.scores[p.id] = (this.scores[p.id] || 0) + 100;
    }
  }

  _handlePowerup(socketId, type) {
    const p = this.players[socketId];
    if (!p || !p.alive) return;
    if (type === PU_BOMB)  p.maxBombs = Math.min(p.maxBombs + 1, 5);
    if (type === PU_RANGE) p.range    = Math.min(p.range + 1, 6);
    if (type === PU_SPEED) p.speed    = Math.min(p.speed + 0.4, 5.5);
    this.scores[socketId] = (this.scores[socketId] || 0) + 50;
    if (this.onAudio) this.onAudio(this.code, 'powerup');
  }

  _nextWorld() {
    if (this.worldIdx + 1 < 3) { // 3 Welten
      this._loadWorld(this.worldIdx + 1);
      this.phase = S_PLAY;
    } else {
      this.phase = S_WIN;
      if (this.onAudio) this.onAudio(this.code, 'level_clear');
    }
  }

  // ── State-Snapshot für Broadcast ─────────────────────────

  getSnapshot() {
    const snap = {
      phase:      this.phase,
      worldIdx:   this.worldIdx,
      players:    Object.values(this.players).map(p => ({
        id:       p.id,
        slot:     p.slot,
        px:       p.px,
        py:       p.py,
        gridX:    p.gridX,
        gridY:    p.gridY,
        targetX:  p.targetX,
        targetY:  p.targetY,
        lives:    p.lives,
        alive:    p.alive,
        invTimer: p.invTimer,
        facing:   p.facing,
        animT:    p.animT,
        bombsOut: p.bombsOut,
        maxBombs: p.maxBombs,
        range:    p.range,
        speed:    p.speed,
      })),
      enemies:    this.enemies.map(e => ({
        id:      e.id,
        px:      e.px,
        py:      e.py,
        gridX:   e.gridX,
        gridY:   e.gridY,
        alive:   e.alive,
        animT:   e.animT,
      })),
      bombs:      this.bombs.map(b => ({ gx: b.gx, gy: b.gy, timer: b.timer })),
      explosions: this.explosions.map(ex => ({
        tiles: ex.tiles, timer: ex.timer, cx: ex.cx, cy: ex.cy,
      })),
      powerups:   this.powerups.map(pu => ({ gx: pu.gx, gy: pu.gy, type: pu.type })),
      scores:     { ...this.scores },
      hostId:     this.hostId,
      code:       this.code,
    };

    // Map nur senden wenn dirty (erspart Bandbreite)
    if (this._mapDirty) {
      snap.map      = this.map;
      this._mapDirty = false;
    } else {
      snap.map = null;
    }

    return snap;
  }

  getLobbySnapshot() {
    return {
      phase:   S_LOBBY,
      code:    this.code,
      hostId:  this.hostId,
      players: Object.values(this.players).map(p => ({
        id:   p.id,
        slot: p.slot,
      })),
    };
  }

  _broadcast() {
    if (this.onBroadcast) this.onBroadcast(this.getSnapshot());
  }
}

module.exports = GameRoom;
