'use strict';

// ============================================================
// SPIELKONSTANTEN – geteilt zwischen Server und Client
// ============================================================
const TILE  = 30;
const COLS  = 13;
const ROWS  = 11;
const CW    = COLS * TILE;  // 390
const CH    = ROWS * TILE;  // 330

// Kacheltypen
const T_EMPTY = 0;
const T_WALL  = 1;
const T_BRICK = 2;

// Spielzustände
const S_LOBBY  = 'lobby';
const S_PLAY   = 'play';
const S_CLEAR  = 'clear';
const S_OVER   = 'over';
const S_WIN    = 'win';

// Spielmechanik
const BOMB_FUSE  = 3.0;  // Sekunden bis Explosion
const EXPL_DUR   = 0.9;  // Explosions-Anzeigedauer
const P_SPEED    = 3.2;  // Standard Spieler-Geschwindigkeit (Kacheln/s)
const E_SPEED    = 1.8;  // KI-Gegner Grundgeschwindigkeit
const INVINCIBLE = 2.5;  // Unverwundbarkeits-Sekunden nach Treffer
const TICK_RATE  = 20;   // Server-Ticks pro Sekunde
const TICK_DT    = 1 / TICK_RATE; // Sekunden pro Tick

// Power-up-Typen
const PU_BOMB  = 'b';
const PU_RANGE = 'r';
const PU_SPEED = 's';

// Spieler-Startpositionen (4 Ecken)
const PLAYER_STARTS = [
  { x: 1,        y: 1        },  // Slot 0: oben links (Host)
  { x: COLS - 2, y: 1        },  // Slot 1: oben rechts
  { x: 1,        y: ROWS - 2 },  // Slot 2: unten links
  { x: COLS - 2, y: ROWS - 2 },  // Slot 3: unten rechts
];

// Sicherheitszonen um alle Startpositionen (3x3)
const SAFE_ZONES = PLAYER_STARTS.flatMap(s => [
  `${s.y},${s.x}`, `${s.y},${s.x + 1}`, `${s.y},${s.x + 2}`,
  `${s.y + 1},${s.x}`,
]);
// Für oben-rechts und unten-rechts auch nach links
const SAFE_ZONES_ALL = new Set([
  // Slot 0: (1,1)
  '1,1','1,2','1,3','2,1','3,1',
  // Slot 1: (11,1) = (COLS-2, 1)
  '1,11','1,10','1,9','2,11','3,11',
  // Slot 2: (1,9) = (1, ROWS-2)
  '9,1','9,2','9,3','8,1','7,1',
  // Slot 3: (11,9) = (COLS-2, ROWS-2)
  '9,11','9,10','9,9','8,11','7,11',
]);

// Einstellungs-Mappings
const SPEED_MAP       = { low: 2.0, normal: 3.2, high: 4.5 };
const COLLECTIBLE_MAP = { wenig: 0.10, normal: 0.30, viel: 0.55, ueberfluss: 0.85 };

// Welten-Konfiguration (KI-Gegner-Anzahl)
const WORLD_ENEMIES = [3, 4, 5];

module.exports = {
  TILE, COLS, ROWS, CW, CH,
  T_EMPTY, T_WALL, T_BRICK,
  S_LOBBY, S_PLAY, S_CLEAR, S_OVER, S_WIN,
  BOMB_FUSE, EXPL_DUR, P_SPEED, E_SPEED, INVINCIBLE,
  TICK_RATE, TICK_DT,
  PU_BOMB, PU_RANGE, PU_SPEED,
  PLAYER_STARTS, SAFE_ZONES_ALL,
  SPEED_MAP, COLLECTIBLE_MAP, WORLD_ENEMIES,
};
