'use strict';

// ============================================================
// SPIELLOGIK – Pure Funktionen (kein State, kein IO)
// ============================================================
const {
  TILE, COLS, ROWS,
  T_EMPTY, T_WALL, T_BRICK,
  BOMB_FUSE, EXPL_DUR, P_SPEED, E_SPEED, INVINCIBLE,
  PU_BOMB, PU_RANGE, PU_SPEED,
  PLAYER_STARTS, SAFE_ZONES_ALL,
  COLLECTIBLE_MAP,
} = require('./constants');

// ────────────────────────────────────────────────────────────
// Map-Generierung
// ────────────────────────────────────────────────────────────
function generateMap() {
  const map = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        map[r][c] = T_WALL;
      } else if (r % 2 === 0 && c % 2 === 0) {
        map[r][c] = T_WALL;
      } else if (SAFE_ZONES_ALL.has(`${r},${c}`)) {
        map[r][c] = T_EMPTY;
      } else {
        map[r][c] = Math.random() < 0.68 ? T_BRICK : T_EMPTY;
      }
    }
  }
  return map;
}

// ────────────────────────────────────────────────────────────
// Bewegungs-Check
// ────────────────────────────────────────────────────────────
function canMove(nx, ny, map, bombs) {
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;
  if (map[ny][nx] === T_WALL || map[ny][nx] === T_BRICK) return false;
  if (bombs.some(b => b.gx === nx && b.gy === ny)) return false;
  return true;
}

// ────────────────────────────────────────────────────────────
// Tachel-Position berechnen (Mittelpunkt des Sprites)
// ────────────────────────────────────────────────────────────
function tileX(px) { return Math.round(px / TILE); }
function tileY(py) { return Math.round(py / TILE); }

// ────────────────────────────────────────────────────────────
// Spieler-Update (gibt 'bomb' zurück wenn Bombe gelegt)
// ────────────────────────────────────────────────────────────
function updatePlayer(player, dt, input, map, bombs) {
  if (!player.alive) return null;
  player.animT += dt;
  if (player.invTimer > 0) player.invTimer -= dt;

  const atDest = Math.abs(player.px - player.targetX * TILE) < 1.5
              && Math.abs(player.py - player.targetY * TILE) < 1.5;

  if (atDest) {
    player.px = player.targetX * TILE;
    player.py = player.targetY * TILE;
    player.gridX = player.targetX;
    player.gridY = player.targetY;

    // Bombe legen
    if (input.bomb && !player._bombConsumed && player.bombsOut < player.maxBombs) {
      if (!bombs.some(b => b.gx === player.gridX && b.gy === player.gridY)) {
        player._bombConsumed = true;
        return 'bomb';
      }
    }
    if (!input.bomb) player._bombConsumed = false;

    // Richtung
    let nx = player.targetX, ny = player.targetY;
    if      (input.up)    { ny--; player.facing = 3; }
    else if (input.down)  { ny++; player.facing = 0; }
    else if (input.left)  { nx--; player.facing = 1; }
    else if (input.right) { nx++; player.facing = 2; }

    if ((nx !== player.targetX || ny !== player.targetY) && canMove(nx, ny, map, bombs)) {
      player.targetX = nx;
      player.targetY = ny;
    }
  } else {
    // Gleiten
    const spd = player.speed * TILE * dt;
    const tx = player.targetX * TILE, ty = player.targetY * TILE;
    const dX = tx - player.px, dY = ty - player.py;
    if (Math.abs(dX) > 0) player.px += Math.sign(dX) * Math.min(spd, Math.abs(dX));
    if (Math.abs(dY) > 0) player.py += Math.sign(dY) * Math.min(spd, Math.abs(dY));
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// KI-Gegner-Update
// ────────────────────────────────────────────────────────────
function updateEnemy(enemy, dt, map, bombs, explosions, players) {
  if (!enemy.alive) return;
  enemy.animT += dt;
  enemy.moveT -= dt;

  const atDest = Math.abs(enemy.px - enemy.targetX * TILE) < 1.5
              && Math.abs(enemy.py - enemy.targetY * TILE) < 1.5;

  if (atDest) {
    enemy.px = enemy.targetX * TILE;
    enemy.py = enemy.targetY * TILE;
    enemy.gridX = enemy.targetX;
    enemy.gridY = enemy.targetY;

    if (enemy.moveT <= 0) {
      enemy.moveT = 0.4 + Math.random() * 1.0;
      enemy.dir = chooseEnemyDir(enemy, map, bombs, explosions, players);
    }

    const nx = enemy.targetX + enemy.dir.dx;
    const ny = enemy.targetY + enemy.dir.dy;

    if (canMove(nx, ny, map, bombs)) {
      enemy.targetX = nx;
      enemy.targetY = ny;
    } else {
      enemy.dir = chooseEnemyDir(enemy, map, bombs, explosions, players);
      enemy.moveT = 0.3;
    }
  } else {
    const spd = enemy.speed * TILE * dt;
    const tx = enemy.targetX * TILE, ty = enemy.targetY * TILE;
    const dX = tx - enemy.px, dY = ty - enemy.py;
    if (Math.abs(dX) > 0) enemy.px += Math.sign(dX) * Math.min(spd, Math.abs(dX));
    if (Math.abs(dY) > 0) enemy.py += Math.sign(dY) * Math.min(spd, Math.abs(dY));
  }
}

function chooseEnemyDir(enemy, map, bombs, explosions, players) {
  const all = [{ dx:0, dy:-1 }, { dx:0, dy:1 }, { dx:-1, dy:0 }, { dx:1, dy:0 }];

  const exSet = new Set();
  for (const ex of explosions)
    for (const t of ex.tiles) exSet.add(`${t.x},${t.y}`);

  const valid = all.filter(d => {
    const nx = enemy.gridX + d.dx, ny = enemy.gridY + d.dy;
    return canMove(nx, ny, map, bombs) && !exSet.has(`${nx},${ny}`);
  });

  if (valid.length === 0) return { dx: 0, dy: 0 };

  // 35% Chance: nächstem Spieler nähern
  const alivePlayers = players.filter(p => p.alive);
  if (alivePlayers.length > 0 && Math.random() < 0.35) {
    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    return valid.sort((a, b) => {
      const dA = Math.abs(enemy.gridX + a.dx - target.gridX) + Math.abs(enemy.gridY + a.dy - target.gridY);
      const dB = Math.abs(enemy.gridX + b.dx - target.gridX) + Math.abs(enemy.gridY + b.dy - target.gridY);
      return dA - dB;
    })[0];
  }

  return valid[Math.floor(Math.random() * valid.length)];
}

// ────────────────────────────────────────────────────────────
// Bomben-Explosion
// ────────────────────────────────────────────────────────────
function explodeBomb(bomb, map, powerups, powerupChance) {
  const tiles  = [{ x: bomb.gx, y: bomb.gy }];
  const bricks = [];
  const dirs   = [[1,0],[-1,0],[0,1],[0,-1]];

  for (const [dx, dy] of dirs) {
    for (let i = 1; i <= bomb.range; i++) {
      const tx = bomb.gx + dx * i;
      const ty = bomb.gy + dy * i;
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) break;
      if (map[ty][tx] === T_WALL) break;
      tiles.push({ x: tx, y: ty });
      if (map[ty][tx] === T_BRICK) {
        map[ty][tx] = T_EMPTY;
        bricks.push({ x: tx, y: ty });
        if (Math.random() < powerupChance) {
          const types = [PU_BOMB, PU_RANGE, PU_SPEED];
          powerups.push({ gx: tx, gy: ty, type: types[Math.floor(Math.random() * 3)] });
        }
        break;
      }
    }
  }
  return { tiles, bricks };
}

// ────────────────────────────────────────────────────────────
// Kollisionsprüfung – gibt Events zurück
// ────────────────────────────────────────────────────────────
function checkCollisions(players, enemies, explosions, powerups, scores) {
  const exSet = new Set();
  for (const ex of explosions)
    for (const t of ex.tiles) exSet.add(`${t.x},${t.y}`);

  const events = [];

  // Spieler in Explosion / berühren Feind
  for (const p of players) {
    if (!p.alive || p.invTimer > 0) continue;
    const ptx = tileX(p.px), pty = tileY(p.py);

    if (exSet.has(`${ptx},${pty}`)) {
      events.push({ type: 'player_hit', id: p.id });
      continue;
    }
    for (const e of enemies) {
      if (e.alive && tileX(e.px) === ptx && tileY(e.py) === pty) {
        events.push({ type: 'player_hit', id: p.id });
        break;
      }
    }
    // Spieler treffen sich gegenseitig (optional: friendly fire)
    // Aktuell: kein friendly fire
  }

  // Feinde in Explosion
  for (const e of enemies) {
    if (e.alive && exSet.has(`${tileX(e.px)},${tileY(e.py)}`)) {
      events.push({ type: 'enemy_killed', id: e.id });
    }
  }

  // Power-ups aufsammeln
  for (const p of players) {
    if (!p.alive) continue;
    const ptx = tileX(p.px), pty = tileY(p.py);
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      if (pu.gx === ptx && pu.gy === pty) {
        events.push({ type: 'powerup', id: p.id, puType: pu.type });
        powerups.splice(i, 1);
      }
    }
  }

  return events;
}

// ────────────────────────────────────────────────────────────
// Neuer Spieler-State
// ────────────────────────────────────────────────────────────
function createPlayerState(socketId, slot) {
  const start = PLAYER_STARTS[slot];
  return {
    id: socketId,
    slot,
    px: start.x * TILE,
    py: start.y * TILE,
    gridX: start.x,
    gridY: start.y,
    targetX: start.x,
    targetY: start.y,
    speed: P_SPEED,
    maxBombs: 1,
    bombsOut: 0,
    range: 2,
    lives: 3,
    invTimer: 0,
    alive: true,
    facing: 0,
    animT: 0,
    _bombConsumed: false,
    input: { up: false, down: false, left: false, right: false, bomb: false },
  };
}

// ────────────────────────────────────────────────────────────
// Neuer KI-Gegner-State
// ────────────────────────────────────────────────────────────
function createEnemyState(id, gx, gy) {
  return {
    id,
    px: gx * TILE,
    py: gy * TILE,
    gridX: gx,
    gridY: gy,
    targetX: gx,
    targetY: gy,
    speed: E_SPEED + Math.random() * 0.6,
    alive: true,
    animT: Math.random() * 2,
    moveT: 0.5 + Math.random(),
    dir: { dx: 0, dy: 1 },
  };
}

// ────────────────────────────────────────────────────────────
// KI-Gegner-Startpositionen (ausserhalb der Spieler-Ecken)
// ────────────────────────────────────────────────────────────
function getEnemySpots() {
  return [
    [COLS - 2, Math.floor(ROWS / 2)],
    [Math.floor(COLS / 2), ROWS - 2],
    [Math.floor(COLS / 2), 1],
    [Math.floor(COLS / 2), Math.floor(ROWS / 2)],
    [3, ROWS - 2],
    [COLS - 4, 1],
  ];
}

module.exports = {
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
};
