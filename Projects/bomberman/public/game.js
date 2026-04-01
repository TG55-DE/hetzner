'use strict';

// ============================================================
// KONSTANTEN
// ============================================================
const TILE  = 30;   // Pixel pro Kachel
const COLS  = 13;   // Spalten
const ROWS  = 11;   // Zeilen
const CW    = COLS * TILE; // Canvas-Breite  390
const CH    = ROWS * TILE; // Canvas-Höhe    330

// Kacheltypen
const T_EMPTY = 0;
const T_WALL  = 1;
const T_BRICK = 2;

// Spielzustände
const S_MENU      = 'menu';
const S_MAIN_MENU = 'mainmenu';
const S_PLAY      = 'play';
const S_PAUSE     = 'pause';
const S_CLEAR     = 'clear';
const S_OVER      = 'over';
const S_WIN       = 'win';

// Einstellungs-Mappings
const SPEED_MAP = { low: 2.0, normal: 3.2, high: 4.5 };
const COLLECTIBLE_MAP = { wenig: 0.10, normal: 0.30, viel: 0.55, ueberfluss: 0.85 };
const SETTINGS_DEFAULTS = { speed: 'normal', collectibles: 'normal', selectedWorld: 0, character: 0 };

// Wird aus den Einstellungen gesetzt
let currentPowerupChance = 0.30;

// Spielmechanik
const BOMB_FUSE   = 3.0;  // Sekunden bis Explosion
const EXPL_DUR    = 0.9;  // Explosions-Anzeigedauer
const P_SPEED     = 3.2;  // Spieler-Geschwindigkeit (Kacheln/s)
const E_SPEED     = 1.8;  // Gegner-Grundgeschwindigkeit
const INVINCIBLE  = 2.5;  // Unverwundbarkeits-Sekunden nach Treffer

// Power-up-Typen
const PU_BOMB  = 'b';  // +1 Bombe
const PU_RANGE = 'r';  // +1 Reichweite
const PU_SPEED = 's';  // +Geschwindigkeit

// ============================================================
// WELTEN – Farbthemen (SNES-Stil)
// ============================================================
const WORLDS = [
  {
    name:       'Wald',
    floor:      '#2f5e1a', floorAlt: '#386e20',
    wall:       '#1c1c2e', wallHi:   '#2a2a44',
    brick:      '#7a3b10', brickHi:  '#a05020', brickSh: '#5a2a08',
    bg:         '#1a3010',
    enemyCol:   '#e53935', enemyEye: '#fff',
    enemies:    3,
    bgTxt:      '#4a8a30',
  },
  {
    name:       'Wüste',
    floor:      '#c49a40', floorAlt: '#b88830',
    wall:       '#5a3015', wallHi:   '#7a4825',
    brick:      '#b83010', brickHi:  '#d84020', brickSh: '#881808',
    bg:         '#8a6020',
    enemyCol:   '#fb8c00', enemyEye: '#fff',
    enemies:    4,
    bgTxt:      '#e0aa50',
  },
  {
    name:       'Eis',
    floor:      '#a8cce8', floorAlt: '#90bbe0',
    wall:       '#2c3e50', wallHi:   '#3d5166',
    brick:      '#607d9c', brickHi:  '#8098b8', brickSh: '#405870',
    bg:         '#5080a8',
    enemyCol:   '#e91e8c', enemyEye: '#fff',
    enemies:    5,
    bgTxt:      '#c8e8ff',
  },
];

// ============================================================
// AUDIO ENGINE – Chiptune via Web Audio API
// ============================================================
class AudioEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* Kein Audio-Support */ }
  }

  _note(freq, type, vol, dur, delay = 0) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  play(snd) {
    switch (snd) {
      case 'bomb_place':
        this._note(440, 'square', 0.18, 0.07);
        this._note(330, 'square', 0.15, 0.07, 0.07);
        break;
      case 'explosion':
        this._note(100, 'sawtooth', 0.5,  0.15);
        this._note(70,  'sawtooth', 0.4,  0.3,  0.05);
        this._note(180, 'square',   0.25, 0.1);
        break;
      case 'brick_break':
        this._note(700, 'square', 0.12, 0.04);
        this._note(500, 'square', 0.10, 0.04, 0.04);
        break;
      case 'powerup':
        [523, 659, 784, 1047].forEach((f, i) =>
          this._note(f, 'square', 0.2, 0.09, i * 0.08)
        );
        break;
      case 'player_die':
        [440, 330, 220, 110].forEach((f, i) =>
          this._note(f, 'square', 0.3, 0.18, i * 0.12)
        );
        break;
      case 'level_clear':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
          this._note(f, 'square', 0.25, 0.1, i * 0.1)
        );
        break;
      case 'game_over':
        [330, 294, 262, 196].forEach((f, i) =>
          this._note(f, 'square', 0.3, 0.22, i * 0.22)
        );
        break;
    }
  }
}

// ============================================================
// INPUT MANAGER – Tastatur + Touch
// ============================================================
class InputManager {
  constructor() {
    this._kbKeys   = { up: false, down: false, left: false, right: false, bomb: false };
    this._touchDir = { up: false, down: false, left: false, right: false };
    this._bombFired = false;
    this._setupKeyboard();
    this._setupBombTouch();
  }

  // Kombinierte Eingabe (Tastatur + Canvas-Touch-Richtung)
  get keys() {
    return {
      up:    this._kbKeys.up    || this._touchDir.up,
      down:  this._kbKeys.down  || this._touchDir.down,
      left:  this._kbKeys.left  || this._touchDir.left,
      right: this._kbKeys.right || this._touchDir.right,
      bomb:  this._kbKeys.bomb,
    };
  }

  _setupKeyboard() {
    const MAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      ' ': 'bomb', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyX: 'bomb',
    };
    window.addEventListener('keydown', e => {
      const k = MAP[e.key] || MAP[e.code];
      if (k) {
        e.preventDefault();
        if (k === 'bomb' && !this._kbKeys.bomb) this._bombFired = true;
        this._kbKeys[k] = true;
      }
    });
    window.addEventListener('keyup', e => {
      const k = MAP[e.key] || MAP[e.code];
      if (k) this._kbKeys[k] = false;
    });
  }

  // Nur Bombe per Button — Richtung kommt vom Canvas-Touch
  _setupBombTouch() {
    const el = document.getElementById('btn-bomb');
    if (!el) return;
    const press = e => {
      e.preventDefault();
      if (!this._kbKeys.bomb) this._bombFired = true;
      this._kbKeys.bomb = true;
      el.classList.add('pressed');
    };
    const release = e => {
      e.preventDefault();
      this._kbKeys.bomb = false;
      el.classList.remove('pressed');
    };
    el.addEventListener('touchstart',  press,   { passive: false });
    el.addEventListener('touchend',    release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
  }

  // Richtung aus Canvas-Touch setzen (dx/dy = Vektor vom Spieler zum Touch-Punkt)
  setTouchDirection(dx, dy) {
    this._touchDir = { up: false, down: false, left: false, right: false };
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) this._touchDir.right = true;
      else        this._touchDir.left  = true;
    } else {
      if (dy > 0) this._touchDir.down = true;
      else        this._touchDir.up   = true;
    }
  }

  clearTouchDirection() {
    this._touchDir = { up: false, down: false, left: false, right: false };
  }

  consumeBomb() {
    const v = this._bombFired;
    this._bombFired = false;
    return v;
  }
}

// ============================================================
// MAP GENERATOR
// ============================================================
function generateMap() {
  const map = [];
  // Sicherheitszone um Spielerstart (1,1): diese Zellen bleiben frei
  const safe = new Set(['1,1','2,1','3,1','1,2','1,3']);

  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1) {
        map[r][c] = T_WALL;  // Randmauern
      } else if (r % 2 === 0 && c % 2 === 0) {
        map[r][c] = T_WALL;  // Innenwände (festes Muster)
      } else if (safe.has(`${r},${c}`)) {
        map[r][c] = T_EMPTY; // Startbereich frei lassen
      } else {
        map[r][c] = Math.random() < 0.68 ? T_BRICK : T_EMPTY;
      }
    }
  }
  return map;
}

// ============================================================
// BOMBE
// ============================================================
class Bomb {
  constructor(gx, gy, range) {
    this.gx    = gx;
    this.gy    = gy;
    this.range = range;
    this.timer = BOMB_FUSE;
  }

  // Gibt Explosion-Kacheln + zerstörte Bricks zurück
  explode(map, powerups) {
    const tiles   = [{ x: this.gx, y: this.gy }];
    const bricks  = [];
    const dirs    = [[1,0],[-1,0],[0,1],[0,-1]];

    for (const [dx, dy] of dirs) {
      for (let i = 1; i <= this.range; i++) {
        const tx = this.gx + dx * i;
        const ty = this.gy + dy * i;
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) break;
        if (map[ty][tx] === T_WALL) break;

        tiles.push({ x: tx, y: ty });

        if (map[ty][tx] === T_BRICK) {
          map[ty][tx] = T_EMPTY;
          bricks.push({ x: tx, y: ty });
          // Power-up mit 30% Chance spawnen
          if (Math.random() < currentPowerupChance) {
            const types = [PU_BOMB, PU_RANGE, PU_SPEED];
            powerups.push({ gx: tx, gy: ty, type: types[Math.floor(Math.random() * 3)] });
          }
          break; // Explosion stoppt am Mauerstein
        }
      }
    }
    return { tiles, bricks };
  }
}

// ============================================================
// SPIELER
// ============================================================
class Player {
  constructor() {
    this.gridX = 1; this.gridY = 1;
    this.px = TILE; this.py = TILE; // Pixel-Position
    this.dx = 1;    this.dy = 1;    // Ziel-Kachel
    this.speed    = P_SPEED;
    this.maxBombs = 1;
    this.bombsOut = 0;
    this.range    = 2;
    this.lives    = 3;
    this.invTimer = 0;
    this.alive    = true;
    this.animT    = 0;
    this.facing   = 0; // 0=down,1=left,2=right,3=up
  }

  update(dt, map, input, bombs) {
    if (!this.alive) return null;
    this.animT += dt;
    if (this.invTimer > 0) this.invTimer -= dt;

    const atDest = Math.abs(this.px - this.dx * TILE) < 1.5
                && Math.abs(this.py - this.dy * TILE) < 1.5;

    if (atDest) {
      this.px = this.dx * TILE;
      this.py = this.dy * TILE;
      this.gridX = this.dx;
      this.gridY = this.dy;

      // Bombe legen
      if (input.consumeBomb() && this.bombsOut < this.maxBombs) {
        if (!bombs.some(b => b.gx === this.gridX && b.gy === this.gridY)) {
          bombs.push(new Bomb(this.gridX, this.gridY, this.range));
          this.bombsOut++;
          return 'bomb';
        }
      }

      // Richtung bestimmen
      let nx = this.dx, ny = this.dy;
      if      (input.keys.up)    { ny--; this.facing = 3; }
      else if (input.keys.down)  { ny++; this.facing = 0; }
      else if (input.keys.left)  { nx--; this.facing = 1; }
      else if (input.keys.right) { nx++; this.facing = 2; }

      if ((nx !== this.dx || ny !== this.dy) && this._canMove(nx, ny, map, bombs)) {
        this.dx = nx; this.dy = ny;
      }
    } else {
      // Zur Ziel-Kachel gleiten
      this._slide(dt);
    }
    return null;
  }

  _slide(dt) {
    const spd = this.speed * TILE * dt;
    const tx = this.dx * TILE, ty = this.dy * TILE;
    const dX = tx - this.px, dY = ty - this.py;
    if (Math.abs(dX) > 0) this.px += Math.sign(dX) * Math.min(spd, Math.abs(dX));
    if (Math.abs(dY) > 0) this.py += Math.sign(dY) * Math.min(spd, Math.abs(dY));
  }

  _canMove(nx, ny, map, bombs) {
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;
    if (map[ny][nx] === T_WALL || map[ny][nx] === T_BRICK) return false;
    if (bombs.some(b => b.gx === nx && b.gy === ny)) return false;
    return true;
  }

  // Zentrierter Kachel-Index (für Kollisionsprüfung)
  tileX() { return Math.round(this.px / TILE); }
  tileY() { return Math.round(this.py / TILE); }
}

// ============================================================
// GEGNER
// ============================================================
class Enemy {
  constructor(gx, gy, id) {
    this.gx     = gx; this.gy     = gy;
    this.gridX  = gx; this.gridY  = gy;
    this.px     = gx * TILE; this.py = gy * TILE;
    this.dx     = gx; this.dy     = gy;
    this.speed  = E_SPEED + Math.random() * 0.6;
    this.alive  = true;
    this.id     = id;
    this.moveT  = 0.5 + Math.random(); // Zeit bis nächste Richtungsänderung
    this.dir    = { dx: 0, dy: 1 };
    this.animT  = Math.random() * 2;
  }

  update(dt, map, bombs, explosions, player) {
    if (!this.alive) return;
    this.animT += dt;
    this.moveT -= dt;

    const atDest = Math.abs(this.px - this.dx * TILE) < 1.5
                && Math.abs(this.py - this.dy * TILE) < 1.5;

    if (atDest) {
      this.px = this.dx * TILE; this.py = this.dy * TILE;
      this.gridX = this.dx;    this.gridY = this.dy;

      if (this.moveT <= 0) {
        this.moveT = 0.4 + Math.random() * 1.0;
        this.dir = this._chooseDir(map, bombs, explosions, player);
      }

      const nx = this.dx + this.dir.dx;
      const ny = this.dy + this.dir.dy;

      if (this._canMove(nx, ny, map, bombs)) {
        this.dx = nx; this.dy = ny;
      } else {
        // Blockiert → neue Richtung sofort wählen
        this.dir = this._chooseDir(map, bombs, explosions, player);
        this.moveT = 0.3;
      }
    } else {
      const spd = this.speed * TILE * dt;
      const tx = this.dx * TILE, ty = this.dy * TILE;
      const dX = tx - this.px, dY = ty - this.py;
      if (Math.abs(dX) > 0) this.px += Math.sign(dX) * Math.min(spd, Math.abs(dX));
      if (Math.abs(dY) > 0) this.py += Math.sign(dY) * Math.min(spd, Math.abs(dY));
    }
  }

  _chooseDir(map, bombs, explosions, player) {
    const all = [{ dx:0, dy:-1 }, { dx:0, dy:1 }, { dx:-1, dy:0 }, { dx:1, dy:0 }];

    // Explosion-Kacheln merken
    const exSet = new Set();
    for (const ex of explosions)
      for (const t of ex.tiles) exSet.add(`${t.x},${t.y}`);

    // Gültige Richtungen: kein Wall/Brick/Bombe/Explosion
    const valid = all.filter(d => {
      const nx = this.gridX + d.dx, ny = this.gridY + d.dy;
      return this._canMove(nx, ny, map, bombs) && !exSet.has(`${nx},${ny}`);
    });

    if (valid.length === 0) return { dx: 0, dy: 0 };

    // 35% Chance: auf Spieler zubewegen (Manhattan)
    if (Math.random() < 0.35) {
      return valid.sort((a, b) => {
        const dA = Math.abs(this.gridX + a.dx - player.gridX) + Math.abs(this.gridY + a.dy - player.gridY);
        const dB = Math.abs(this.gridX + b.dx - player.gridX) + Math.abs(this.gridY + b.dy - player.gridY);
        return dA - dB;
      })[0];
    }

    return valid[Math.floor(Math.random() * valid.length)];
  }

  _canMove(nx, ny, map, bombs) {
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;
    if (map[ny][nx] === T_WALL || map[ny][nx] === T_BRICK) return false;
    if (bombs.some(b => b.gx === nx && b.gy === ny)) return false;
    return true;
  }

  tileX() { return Math.round(this.px / TILE); }
  tileY() { return Math.round(this.py / TILE); }
}

// ============================================================
// RENDERER
// ============================================================
class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  clear(world) {
    this.ctx.fillStyle = world.bg;
    this.ctx.fillRect(0, 0, CW, CH);
  }

  drawFloor(world) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? world.floor : world.floorAlt;
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
  }

  drawTiles(map, world) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE, y = r * TILE;
        if (map[r][c] === T_WALL) {
          this._drawWall(x, y, world);
        } else if (map[r][c] === T_BRICK) {
          this._drawBrick(x, y, world);
        }
      }
    }
  }

  _drawWall(x, y, world) {
    const ctx = this.ctx;
    ctx.fillStyle = world.wall;
    ctx.fillRect(x, y, TILE, TILE);
    // Highlight oben links
    ctx.fillStyle = world.wallHi;
    ctx.fillRect(x, y, TILE, 3);
    ctx.fillRect(x, y, 3, TILE);
    // Schatten unten rechts
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + TILE - 3, y, 3, TILE);
    ctx.fillRect(x, y + TILE - 3, TILE, 3);
  }

  _drawBrick(x, y, world) {
    const ctx = this.ctx;
    ctx.fillStyle = world.brick;
    ctx.fillRect(x, y, TILE, TILE);
    // Ziegel-Muster
    ctx.fillStyle = world.brickSh;
    ctx.fillRect(x + 1, y + 7,  TILE - 2, 2);
    ctx.fillRect(x + 1, y + 15, TILE - 2, 2);
    ctx.fillRect(x + 1, y + 23, TILE - 2, 2);
    ctx.fillRect(x + TILE/2, y + 1, 2, 6);
    ctx.fillRect(x + TILE/4, y + 9, 2, 6);
    ctx.fillRect(x + TILE*3/4, y + 9, 2, 6);
    ctx.fillRect(x + TILE/2, y + 17, 2, 6);
    ctx.fillRect(x + TILE/4, y + 25, 2, 4);
    // Highlight
    ctx.fillStyle = world.brickHi;
    ctx.fillRect(x + 1, y + 1, TILE - 2, 1);
  }

  drawBombs(bombs, time) {
    const ctx = this.ctx;
    for (const b of bombs) {
      const x = b.gx * TILE, y = b.gy * TILE;
      const pulse = 0.85 + Math.sin(time * 8 - b.timer * 10) * 0.15;
      const s = TILE * 0.72 * pulse;
      const ox = x + TILE/2, oy = y + TILE/2;

      // Bomben-Körper
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(ox, oy + 2, s / 2, 0, Math.PI * 2);
      ctx.fill();
      // Glanzpunkt
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(ox - s*0.12, oy - s*0.1, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Zündschnur
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox + 3, oy - s/2 + 2);
      ctx.quadraticCurveTo(ox + 8, oy - s/2 - 5, ox + 5, oy - s/2 - 8);
      ctx.stroke();
      // Funke (blinkt)
      const fAlpha = 0.5 + Math.sin(time * 15) * 0.5;
      ctx.fillStyle = `rgba(255, 200, 0, ${fAlpha})`;
      ctx.beginPath();
      ctx.arc(ox + 5, oy - s/2 - 9, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawExplosions(explosions, time) {
    const ctx = this.ctx;
    for (const ex of explosions) {
      const prog = 1 - ex.timer / EXPL_DUR; // 0..1
      const alpha = prog < 0.6 ? 1.0 : 1.0 - (prog - 0.6) / 0.4;

      for (const t of ex.tiles) {
        const x = t.x * TILE, y = t.y * TILE;
        const isCenter = t.x === ex.cx && t.y === ex.cy;
        const flicker = 0.7 + Math.sin(time * 20) * 0.3;

        ctx.globalAlpha = alpha;
        // Äußerer Schein (orange)
        ctx.fillStyle = `rgba(255, 120, 0, ${0.85 * flicker})`;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        // Inneres (gelb)
        ctx.fillStyle = `rgba(255, 240, 60, ${flicker})`;
        ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
        if (isCenter) {
          // Zentrum: heller
          ctx.fillStyle = `rgba(255, 255, 200, ${flicker})`;
          ctx.fillRect(x + 9, y + 9, TILE - 18, TILE - 18);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  drawPowerups(powerups, time) {
    const ctx = this.ctx;
    for (const pu of powerups) {
      const x = pu.gx * TILE + 4, y = pu.gy * TILE + 4;
      const s = TILE - 8;
      const bob = Math.sin(time * 4) * 2;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 1, y + 1 + bob, s, s);

      if (pu.type === PU_BOMB) {
        ctx.fillStyle = '#ffd740';
        ctx.fillRect(x, y + bob, s, s);
        ctx.fillStyle = '#333';
        ctx.font = `bold ${s - 4}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+💣', x + s/2, y + s/2 + bob);
      } else if (pu.type === PU_RANGE) {
        ctx.fillStyle = '#80deea';
        ctx.fillRect(x, y + bob, s, s);
        ctx.fillStyle = '#004d40';
        ctx.font = `bold ${s - 4}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+R', x + s/2, y + s/2 + bob);
      } else {
        ctx.fillStyle = '#a5d6a7';
        ctx.fillRect(x, y + bob, s, s);
        ctx.fillStyle = '#1b5e20';
        ctx.font = `bold ${s - 4}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+S', x + s/2, y + s/2 + bob);
      }
    }
  }

  drawPlayer(player, time, world) {
    if (!player.alive) return;
    const ctx = this.ctx;
    const x = player.px, y = player.py;
    const inv = player.invTimer > 0 && Math.floor(time * 8) % 2 === 0;
    if (inv) return; // Blinken während Unverwundbarkeit

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + TILE/2, y + TILE - 3, TILE/2 - 3, 4, 0, 0, Math.PI*2);
    ctx.fill();

    // Körper (weiß/blau)
    ctx.fillStyle = '#e8f4ff';
    ctx.fillRect(x + 5, y + 12, TILE - 10, TILE - 14);

    // Helm / Kopf
    ctx.fillStyle = '#fce4ec';
    ctx.fillRect(x + 4, y + 3, TILE - 8, 12);

    // Helm-Streifen
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(x + 4, y + 2, TILE - 8, 4);

    // Augen
    const eyeAnim = player.facing;
    ctx.fillStyle = '#1a1a2e';
    if (eyeAnim === 1) { // links
      ctx.fillRect(x + 5,  y + 7, 3, 3);
      ctx.fillRect(x + 10, y + 7, 3, 3);
    } else if (eyeAnim === 2) { // rechts
      ctx.fillRect(x + 14, y + 7, 3, 3);
      ctx.fillRect(x + 19, y + 7, 3, 3);
    } else { // vorne/hinten
      ctx.fillRect(x + 7,  y + 7, 3, 3);
      ctx.fillRect(x + 16, y + 7, 3, 3);
    }

    // Beine (Lauf-Animation)
    const legOff = Math.sin(time * 12) * 2;
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(x + 5,          y + TILE - 8, 8, 6 + legOff);
    ctx.fillRect(x + TILE - 13, y + TILE - 8, 8, 6 - legOff);
  }

  drawEnemy(enemy, time, world) {
    if (!enemy.alive) return;
    const ctx = this.ctx;
    const x = enemy.px, y = enemy.py;

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + TILE/2, y + TILE - 3, TILE/2 - 3, 4, 0, 0, Math.PI*2);
    ctx.fill();

    // Körper
    const bob = Math.sin(time * 5 + enemy.id) * 1.5;
    ctx.fillStyle = world.enemyCol;
    ctx.fillRect(x + 4, y + 4 + bob, TILE - 8, TILE - 6);

    // Augen (grimmig: nach unten geneigt)
    ctx.fillStyle = world.enemyEye;
    ctx.fillRect(x + 6, y + 7 + bob, 5, 5);
    ctx.fillRect(x + TILE - 11, y + 7 + bob, 5, 5);
    // Pupillen
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 8, y + 8 + bob, 2, 3);
    ctx.fillRect(x + TILE - 9, y + 8 + bob, 2, 3);
    // Stirnrunzeln
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 5, y + 5 + bob, 6, 2);
    ctx.fillRect(x + TILE - 11, y + 5 + bob, 6, 2);

    // Mund
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 7, y + TILE - 9 + bob, TILE - 14, 3);

    // Beine
    const legA = Math.sin(time * 8 + enemy.id) * 2;
    ctx.fillStyle = world.enemyCol;
    ctx.fillRect(x + 5,         y + TILE - 7, 7, 5 + legA);
    ctx.fillRect(x + TILE - 12, y + TILE - 7, 7, 5 - legA);
  }

  drawOverlay(state, world, worldIdx, score) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, CW, CH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state === S_MENU) {
      ctx.fillStyle = '#ffd740';
      ctx.font = 'bold 32px "Courier New", monospace';
      ctx.fillText('💣 BOMBERMAN', CW/2, CH/2 - 70);

      ctx.fillStyle = '#80cbc4';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText('SNES-Stil · 3 Welten · KI-Gegner', CW/2, CH/2 - 35);

      ctx.fillStyle = '#fff';
      ctx.font = '13px "Courier New", monospace';
      ctx.fillText('▲▼◀▶  Bewegen', CW/2, CH/2 + 5);
      ctx.fillText('💣  Bombe legen', CW/2, CH/2 + 25);
      ctx.fillText('Alle Gegner besiegen = Level klar!', CW/2, CH/2 + 50);

      ctx.fillStyle = '#a5d6a7';
      ctx.font = 'bold 16px "Courier New", monospace';
      const blink = Math.floor(Date.now() / 600) % 2 === 0;
      if (blink) ctx.fillText('▶ Tippen zum Starten ◀', CW/2, CH/2 + 85);

    } else if (state === S_CLEAR) {
      ctx.fillStyle = '#ffd740';
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.fillText('LEVEL GESCHAFFT!', CW/2, CH/2 - 40);
      ctx.fillStyle = '#a5d6a7';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText(`Score: ${score}`, CW/2, CH/2);
      if (worldIdx < WORLDS.length - 1) {
        ctx.fillStyle = '#80cbc4';
        ctx.fillText(`Weiter: ${WORLDS[worldIdx + 1].name}`, CW/2, CH/2 + 30);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '13px "Courier New", monospace';
      const blink = Math.floor(Date.now() / 600) % 2 === 0;
      if (blink) ctx.fillText('Tippen zum Fortfahren', CW/2, CH/2 + 65);

    } else if (state === S_OVER) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillText('GAME OVER', CW/2, CH/2 - 40);
      ctx.fillStyle = '#fff';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText(`Score: ${score}`, CW/2, CH/2);
      ctx.fillStyle = '#ffd740';
      ctx.font = '13px "Courier New", monospace';
      const blink = Math.floor(Date.now() / 600) % 2 === 0;
      if (blink) ctx.fillText('Tippen um neu zu starten', CW/2, CH/2 + 40);

    } else if (state === S_WIN) {
      ctx.fillStyle = '#ffd740';
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.fillText('🏆 GEWONNEN! 🏆', CW/2, CH/2 - 50);
      ctx.fillStyle = '#a5d6a7';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText('Alle 3 Welten bezwungen!', CW/2, CH/2 - 15);
      ctx.fillStyle = '#ffd740';
      ctx.fillText(`Finaler Score: ${score}`, CW/2, CH/2 + 15);
      ctx.fillStyle = '#fff';
      ctx.font = '13px "Courier New", monospace';
      const blink = Math.floor(Date.now() / 600) % 2 === 0;
      if (blink) ctx.fillText('Tippen um neu zu spielen', CW/2, CH/2 + 55);
    }
  }
}

// ============================================================
// HAUPT-SPIELKLASSE
// ============================================================
class BombermanGame {
  constructor(canvas) {
    this.canvas   = canvas;
    this.renderer = new Renderer(canvas.getContext('2d'));
    this.audio    = new AudioEngine();
    this.input    = new InputManager();
    this.state    = S_MAIN_MENU;
    this.worldIdx = 0;
    this.score    = 0;
    this.time     = 0;
    this.map      = null;
    this.player   = null;
    this.enemies  = [];
    this.bombs    = [];
    this.explosions = [];
    this.powerups = [];
    this._lastTime = 0;
    this.settings = this._loadSettings();

    // Canvas-Touch: Richtungssteuerung im Spiel, Tap auf Overlays
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.state === S_PLAY) this._handlePlayTouch(e.touches[0]);
      else this._onTap();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (this.state === S_PLAY && e.touches.length > 0) this._handlePlayTouch(e.touches[0]);
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (this.state === S_PLAY) this.input.clearTouchDirection();
    }, { passive: false });
    canvas.addEventListener('touchcancel', e => {
      e.preventDefault();
      this.input.clearTouchDirection();
    }, { passive: false });
    canvas.addEventListener('mousedown',  () => this._onTap());
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && this.state === S_PLAY) this._pause();
      if (e.code === 'Enter') this._onTap();
    });

    this._setupMenuHandlers();
  }

  _loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('bomberman_settings'));
      return Object.assign({}, SETTINGS_DEFAULTS, s);
    } catch (e) { return Object.assign({}, SETTINGS_DEFAULTS); }
  }

  _saveSettings() {
    localStorage.setItem('bomberman_settings', JSON.stringify(this.settings));
  }

  _applySettingsToUI() {
    document.querySelectorAll('.world-btn').forEach(btn =>
      btn.classList.toggle('active', parseInt(btn.dataset.world) === this.settings.selectedWorld));
    document.querySelectorAll('.speed-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.speed === this.settings.speed));
    document.querySelectorAll('.coll-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.coll === this.settings.collectibles));
    document.querySelectorAll('.char-btn').forEach(btn =>
      btn.classList.toggle('active', parseInt(btn.dataset.char) === this.settings.character));
  }

  _setupMenuHandlers() {
    // Pause-Button
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('touchstart', e => { e.preventDefault(); this._pause(); }, { passive: false });
      pauseBtn.addEventListener('mousedown', () => this._pause());
    }

    // Pause-Overlay
    const resumeBtn = document.getElementById('btn-resume');
    const toMenuBtn = document.getElementById('btn-to-menu');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this._resume());
    if (toMenuBtn) toMenuBtn.addEventListener('click', () => this._goToMainMenu());

    // Tab-Wechsel
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        btn.classList.add('active');
        const tab = document.getElementById('tab-' + btn.dataset.tab);
        if (tab) tab.classList.remove('hidden');
      });
    });

    // Welt-Auswahl
    document.querySelectorAll('.world-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.selectedWorld = parseInt(btn.dataset.world);
        this._saveSettings();
      });
    });

    // Geschwindigkeit
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.speed = btn.dataset.speed;
        this._saveSettings();
      });
    });

    // Collectibles
    document.querySelectorAll('.coll-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.coll-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.collectibles = btn.dataset.coll;
        this._saveSettings();
      });
    });

    // Start-Button
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) startBtn.addEventListener('click', () => this._startGameFromMenu());
  }

  _pause() {
    if (this.state !== S_PLAY) return;
    this.state = S_PAUSE;
    const el = document.getElementById('pause-overlay');
    if (el) el.classList.remove('hidden');
  }

  _resume() {
    if (this.state !== S_PAUSE) return;
    this.state = S_PLAY;
    const el = document.getElementById('pause-overlay');
    if (el) el.classList.add('hidden');
  }

  _goToMainMenu() {
    this.state = S_MAIN_MENU;
    const pause = document.getElementById('pause-overlay');
    const menu  = document.getElementById('main-menu-overlay');
    const pauseBtn = document.getElementById('btn-pause');
    if (pause) pause.classList.add('hidden');
    if (menu)  menu.classList.remove('hidden');
    if (pauseBtn) pauseBtn.classList.add('hidden');
    this._applySettingsToUI();
    // Tabs zurücksetzen auf "Spiel starten"
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const firstTab = document.querySelector('.tab-btn[data-tab="start"]');
    const firstContent = document.getElementById('tab-start');
    if (firstTab) firstTab.classList.add('active');
    if (firstContent) firstContent.classList.remove('hidden');
  }

  _startGameFromMenu() {
    const menu = document.getElementById('main-menu-overlay');
    const pauseBtn = document.getElementById('btn-pause');
    if (menu) menu.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.remove('hidden');
    // Einstellungen anwenden
    currentPowerupChance = COLLECTIBLE_MAP[this.settings.collectibles] || 0.30;
    const baseSpeed = SPEED_MAP[this.settings.speed] || 3.2;
    this._loadWorld(this.settings.selectedWorld);
    if (this.player) this.player.speed = baseSpeed;
    this.score = 0;
    this._updateHUD();
    this.state = S_PLAY;
  }

  _onTap() {
    if (this.state === S_CLEAR) { this._nextWorld(); }
    if (this.state === S_OVER || this.state === S_WIN) { this._goToMainMenu(); }
  }

  // Touch-Position → Richtung relativ zum Spieler berechnen
  _handlePlayTouch(touch) {
    if (!this.player) return;
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const tx = (touch.clientX - rect.left) * scaleX;
    const ty = (touch.clientY - rect.top)  * scaleY;
    // Spieler-Mitte in Canvas-Koordinaten
    const px = this.player.px + TILE / 2;
    const py = this.player.py + TILE / 2;
    const dx = tx - px;
    const dy = ty - py;
    // Mindestabstand: vermeidet Zittern bei Touch direkt auf Charakter
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    this.input.setTouchDirection(dx, dy);
  }

  _loadWorld(idx) {
    this.worldIdx = idx;
    this.map      = generateMap();
    this.player   = new Player();
    this.bombs    = [];
    this.explosions = [];
    this.powerups = [];
    this.enemies  = this._spawnEnemies(WORLDS[idx].enemies);
    this._updateHUD();
  }

  _spawnEnemies(count) {
    // Startpositionen weit vom Spieler (1,1)
    const spots = [
      [COLS-2, 1], [COLS-2, ROWS-2], [1, ROWS-2],
      [COLS-2, Math.floor(ROWS/2)],
      [Math.floor(COLS/2), ROWS-2],
      [Math.floor(COLS/2), 1],
    ];
    const enemies = [];
    for (let i = 0; i < count; i++) {
      const [gx, gy] = spots[i % spots.length];
      // Sicherstellen dass Startpunkt frei ist
      if (this.map[gy][gx] === T_BRICK) this.map[gy][gx] = T_EMPTY;
      enemies.push(new Enemy(gx, gy, i));
    }
    return enemies;
  }

  _nextWorld() {
    if (this.worldIdx + 1 < WORLDS.length) {
      this._loadWorld(this.worldIdx + 1);
      this.state = S_PLAY;
    } else {
      this.state = S_WIN;
      this.audio.play('level_clear');
    }
  }

  _restart() {
    this.score = 0;
    this._goToMainMenu();
  }

  _updateHUD() {
    const s = document.getElementById('hud-score');
    const l = document.getElementById('hud-lives');
    if (s) s.textContent = `${this.score} Pkt`;
    if (l && this.player) {
      l.textContent = '\u2665'.repeat(Math.max(0, this.player.lives));
    }
  }

  _explodeBomb(bomb) {
    const idx = this.bombs.indexOf(bomb);
    if (idx === -1) return; // Bereits explodiert (Kettenreaktion)
    this.bombs.splice(idx, 1);

    if (this.player) this.player.bombsOut = Math.max(0, this.player.bombsOut - 1);

    const { tiles, bricks } = bomb.explode(this.map, this.powerups);

    this.explosions.push({
      tiles,
      timer: EXPL_DUR,
      cx: bomb.gx,
      cy: bomb.gy,
    });

    this.audio.play('explosion');
    if (bricks.length > 0) this.audio.play('brick_break');

    // Kettenreaktion: andere Bomben im Explosionsbereich
    const tileSet = new Set(tiles.map(t => `${t.x},${t.y}`));
    for (const other of [...this.bombs]) {
      if (tileSet.has(`${other.gx},${other.gy}`)) {
        this._explodeBomb(other);
      }
    }
  }

  _checkCollisions() {
    // Alle aktuell explodierenden Kacheln sammeln
    const exSet = new Set();
    for (const ex of this.explosions)
      for (const t of ex.tiles) exSet.add(`${t.x},${t.y}`);

    const p = this.player;

    // Spieler in Explosion?
    if (p && p.alive && p.invTimer <= 0) {
      if (exSet.has(`${p.tileX()},${p.tileY()}`)) {
        this._killPlayer();
      }
    }

    // Gegner in Explosion?
    for (const e of this.enemies) {
      if (e.alive && exSet.has(`${e.tileX()},${e.tileY()}`)) {
        e.alive = false;
        this.score += 100;
        this._updateHUD();
      }
    }

    // Gegner berühren Spieler?
    if (p && p.alive && p.invTimer <= 0) {
      for (const e of this.enemies) {
        if (e.alive && e.tileX() === p.tileX() && e.tileY() === p.tileY()) {
          this._killPlayer();
          break;
        }
      }
    }

    // Power-ups einsammeln
    if (p && p.alive) {
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        if (pu.gx === p.tileX() && pu.gy === p.tileY()) {
          this._applyPowerup(pu.type);
          this.powerups.splice(i, 1);
          this.audio.play('powerup');
        }
      }
    }
  }

  _killPlayer() {
    const p = this.player;
    p.invTimer = INVINCIBLE;
    p.lives--;
    this.audio.play('player_die');
    this._updateHUD();

    if (p.lives <= 0) {
      p.alive = false;
      setTimeout(() => {
        this.state = S_OVER;
        this.audio.play('game_over');
      }, 800);
    } else {
      // Zurück zum Start
      p.gridX = p.dx = p.px = 1;
      p.gridY = p.dy = p.py = 1;
      p.px = TILE; p.py = TILE;
    }
  }

  _applyPowerup(type) {
    const p = this.player;
    if (type === PU_BOMB)  { p.maxBombs = Math.min(p.maxBombs + 1, 5); this.score += 50; }
    if (type === PU_RANGE) { p.range    = Math.min(p.range + 1, 6);    this.score += 50; }
    if (type === PU_SPEED) { p.speed    = Math.min(p.speed + 0.4, 5.5); this.score += 50; }
    this._updateHUD();
  }

  update(dt) {
    if (this.state !== S_PLAY) return;

    // Spieler
    const pAction = this.player.update(dt, this.map, this.input, this.bombs);
    if (pAction === 'bomb') this.audio.play('bomb_place');

    // Gegner
    for (const e of this.enemies)
      e.update(dt, this.map, this.bombs, this.explosions, this.player);

    // Bomben-Timers
    for (const b of [...this.bombs]) {
      b.timer -= dt;
      if (b.timer <= 0) this._explodeBomb(b);
    }

    // Explosions-Timers
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].timer -= dt;
      if (this.explosions[i].timer <= 0) this.explosions.splice(i, 1);
    }

    // Kollisionen
    this._checkCollisions();

    // Level gewonnen (alle Gegner tot)?
    if (this.player.alive && this.enemies.every(e => !e.alive)) {
      this.score += 500;
      this._updateHUD();
      this.state = S_CLEAR;
      this.audio.play('level_clear');
    }
  }

  render() {
    const world = WORLDS[this.worldIdx];
    const r     = this.renderer;
    const t     = this.time;

    r.drawFloor(world);
    r.drawTiles(this.map || generateMap(), world);
    r.drawPowerups(this.powerups, t);
    r.drawBombs(this.bombs, t);
    r.drawExplosions(this.explosions, t);

    if (this.player) r.drawPlayer(this.player, t, world);
    for (const e of this.enemies) r.drawEnemy(e, t, world);

    if (this.state === S_CLEAR || this.state === S_OVER || this.state === S_WIN) {
      r.drawOverlay(this.state, world, this.worldIdx, this.score);
    }
  }

  loop(ts) {
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;
    this.time += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame(ts => this.loop(ts));
  }

  start() {
    this.audio.init();
    this._loadWorld(0);
    this.state = S_MAIN_MENU;
    this._applySettingsToUI();
    // Hauptmenü anzeigen
    const menu = document.getElementById('main-menu-overlay');
    if (menu) menu.classList.remove('hidden');
    requestAnimationFrame(ts => {
      this._lastTime = ts;
      this.loop(ts);
    });
  }
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const game   = new BombermanGame(canvas);
  game.start();
});
