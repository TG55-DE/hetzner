'use strict';

// ============================================================
// CLIENT-KONSTANTEN (gespiegelt von server/constants.js)
// ============================================================
const TILE  = 30;
const COLS  = 13;
const ROWS  = 11;
const CW    = COLS * TILE;
const CH    = ROWS * TILE;

const T_EMPTY = 0;
const T_WALL  = 1;
const T_BRICK = 2;

const S_LOBBY = 'lobby';
const S_PLAY  = 'play';
const S_CLEAR = 'clear';
const S_OVER  = 'over';
const S_WIN   = 'win';

const EXPL_DUR = 0.9;

// Spieler-Farben nach Slot
const PLAYER_COLORS = [
  { body: '#e8f4ff', helm: '#1565c0', legs: '#1565c0', face: '#fce4ec' }, // Slot 0: Blau
  { body: '#e8ffe8', helm: '#2e7d32', legs: '#2e7d32', face: '#f1f8e9' }, // Slot 1: Grün
  { body: '#fff3e0', helm: '#e65100', legs: '#e65100', face: '#ffe0b2' }, // Slot 2: Orange
  { body: '#f3e5f5', helm: '#6a1b9a', legs: '#6a1b9a', face: '#fce4ec' }, // Slot 3: Lila
];

const WORLDS = [
  { name:'Wald',   floor:'#2f5e1a', floorAlt:'#386e20', wall:'#1c1c2e', wallHi:'#2a2a44', brick:'#7a3b10', brickHi:'#a05020', brickSh:'#5a2a08', bg:'#1a3010', enemyCol:'#e53935', enemyEye:'#fff', bgTxt:'#4a8a30' },
  { name:'Wüste',  floor:'#c49a40', floorAlt:'#b88830', wall:'#5a3015', wallHi:'#7a4825', brick:'#b83010', brickHi:'#d84020', brickSh:'#881808', bg:'#8a6020', enemyCol:'#fb8c00', enemyEye:'#fff', bgTxt:'#e0aa50' },
  { name:'Eis',    floor:'#a8cce8', floorAlt:'#90bbe0', wall:'#2c3e50', wallHi:'#3d5166', brick:'#607d9c', brickHi:'#8098b8', brickSh:'#405870', bg:'#5080a8', enemyCol:'#e91e8c', enemyEye:'#fff', bgTxt:'#c8e8ff' },
];

// ============================================================
// AUDIO ENGINE
// ============================================================
class AudioEngine {
  constructor() { this.ctx = null; }

  init() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }

  _note(freq, type, vol, dur, delay = 0) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.connect(g); g.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.01);
  }

  play(snd) {
    switch(snd) {
      case 'bomb_place':
        this._note(440,'square',0.18,0.07); this._note(330,'square',0.15,0.07,0.07); break;
      case 'explosion':
        this._note(100,'sawtooth',0.5,0.15); this._note(70,'sawtooth',0.4,0.3,0.05); this._note(180,'square',0.25,0.1); break;
      case 'brick_break':
        this._note(700,'square',0.12,0.04); this._note(500,'square',0.10,0.04,0.04); break;
      case 'powerup':
        [523,659,784,1047].forEach((f,i) => this._note(f,'square',0.2,0.09,i*0.08)); break;
      case 'player_die':
        [440,330,220,110].forEach((f,i) => this._note(f,'square',0.3,0.18,i*0.12)); break;
      case 'level_clear':
        [523,659,784,1047,784,1047].forEach((f,i) => this._note(f,'square',0.25,0.1,i*0.1)); break;
      case 'game_over':
        [330,294,262,196].forEach((f,i) => this._note(f,'square',0.3,0.22,i*0.22)); break;
    }
  }
}

// ============================================================
// INPUT MANAGER – nur lokaler Input; wird per Socket gesendet
// ============================================================
class InputManager {
  constructor() {
    this._kbKeys   = { up:false, down:false, left:false, right:false, bomb:false };
    this._touchDir = { up:false, down:false, left:false, right:false };
    this._stickDir = { up:false, down:false, left:false, right:false };
    this._bombFired = false;
    this._setupKeyboard();
    this._setupBombTouch();
  }

  get dir() {
    const u = this._kbKeys.up    || this._touchDir.up    || this._stickDir.up;
    const d = this._kbKeys.down  || this._touchDir.down  || this._stickDir.down;
    const l = this._kbKeys.left  || this._touchDir.left  || this._stickDir.left;
    const r = this._kbKeys.right || this._touchDir.right || this._stickDir.right;
    if (u) return 'up';
    if (d) return 'down';
    if (l) return 'left';
    if (r) return 'right';
    return null;
  }

  get bomb() {
    return this._kbKeys.bomb;
  }

  _setupKeyboard() {
    const MAP = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', ' ':'bomb', KeyW:'up', KeyS:'down', KeyA:'left', KeyD:'right', KeyX:'bomb' };
    window.addEventListener('keydown', e => {
      const k = MAP[e.key] || MAP[e.code];
      if (k) { e.preventDefault(); this._kbKeys[k] = true; }
    });
    window.addEventListener('keyup', e => {
      const k = MAP[e.key] || MAP[e.code];
      if (k) this._kbKeys[k] = false;
    });
  }

  _setupBombTouch() {
    const el = document.getElementById('btn-bomb');
    if (!el) return;
    const press   = e => { e.preventDefault(); this._kbKeys.bomb = true;  el.classList.add('pressed');    };
    const release = e => { e.preventDefault(); this._kbKeys.bomb = false; el.classList.remove('pressed'); };
    el.addEventListener('touchstart',  press,   { passive:false });
    el.addEventListener('touchend',    release, { passive:false });
    el.addEventListener('touchcancel', release, { passive:false });
  }

  setTouchDirection(dx, dy) {
    this._touchDir = { up:false, down:false, left:false, right:false };
    if (Math.abs(dx) > Math.abs(dy)) { dx>0 ? this._touchDir.right=true : this._touchDir.left=true; }
    else                              { dy>0 ? this._touchDir.down=true  : this._touchDir.up=true;   }
  }
  clearTouchDirection() { this._touchDir = { up:false, down:false, left:false, right:false }; }

  setStickDirection(dx, dy) {
    this._stickDir = { up:false, down:false, left:false, right:false };
    const DEAD = 12;
    if (Math.abs(dx) < DEAD && Math.abs(dy) < DEAD) return;
    if (Math.abs(dx) > Math.abs(dy)) { dx>0 ? this._stickDir.right=true : this._stickDir.left=true; }
    else                              { dy>0 ? this._stickDir.down=true  : this._stickDir.up=true;   }
  }
  clearStickDirection() { this._stickDir = { up:false, down:false, left:false, right:false }; }
}

// ============================================================
// RENDERER – rendert Server-State auf Canvas
// ============================================================
class Renderer {
  constructor(ctx) { this.ctx = ctx; }

  clear(world) {
    this.ctx.fillStyle = world.bg;
    this.ctx.fillRect(0, 0, CW, CH);
  }

  drawFloor(world) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r+c)%2===0 ? world.floor : world.floorAlt;
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
      }
  }

  drawTiles(map, world) {
    if (!map) return;
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const x=c*TILE, y=r*TILE;
        if (map[r][c]===T_WALL)  this._drawWall(x,y,world);
        else if (map[r][c]===T_BRICK) this._drawBrick(x,y,world);
      }
  }

  _drawWall(x,y,world) {
    const ctx=this.ctx;
    ctx.fillStyle=world.wall; ctx.fillRect(x,y,TILE,TILE);
    ctx.fillStyle=world.wallHi; ctx.fillRect(x,y,TILE,3); ctx.fillRect(x,y,3,TILE);
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x+TILE-3,y,3,TILE); ctx.fillRect(x,y+TILE-3,TILE,3);
  }

  _drawBrick(x,y,world) {
    const ctx=this.ctx;
    ctx.fillStyle=world.brick; ctx.fillRect(x,y,TILE,TILE);
    ctx.fillStyle=world.brickSh;
    ctx.fillRect(x+1,y+7,TILE-2,2); ctx.fillRect(x+1,y+15,TILE-2,2); ctx.fillRect(x+1,y+23,TILE-2,2);
    ctx.fillRect(x+TILE/2,y+1,2,6); ctx.fillRect(x+TILE/4,y+9,2,6);
    ctx.fillRect(x+TILE*3/4,y+9,2,6); ctx.fillRect(x+TILE/2,y+17,2,6);
    ctx.fillRect(x+TILE/4,y+25,2,4);
    ctx.fillStyle=world.brickHi; ctx.fillRect(x+1,y+1,TILE-2,1);
  }

  drawBombs(bombs, time) {
    const ctx=this.ctx;
    for (const b of bombs) {
      const x=b.gx*TILE, y=b.gy*TILE;
      const pulse=0.85+Math.sin(time*8-b.timer*10)*0.15;
      const s=TILE*0.72*pulse, ox=x+TILE/2, oy=y+TILE/2;
      ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(ox,oy+2,s/2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(ox-s*0.12,oy-s*0.1,s*0.15,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#8B4513'; ctx.lineWidth=2; ctx.beginPath();
      ctx.moveTo(ox+3,oy-s/2+2); ctx.quadraticCurveTo(ox+8,oy-s/2-5,ox+5,oy-s/2-8); ctx.stroke();
      const fAlpha=0.5+Math.sin(time*15)*0.5;
      ctx.fillStyle=`rgba(255,200,0,${fAlpha})`; ctx.beginPath(); ctx.arc(ox+5,oy-s/2-9,3,0,Math.PI*2); ctx.fill();
    }
  }

  drawExplosions(explosions, time) {
    const ctx=this.ctx;
    for (const ex of explosions) {
      const prog=1-ex.timer/EXPL_DUR;
      const alpha=prog<0.6?1.0:1.0-(prog-0.6)/0.4;
      for (const t of ex.tiles) {
        const x=t.x*TILE, y=t.y*TILE;
        const isCenter=t.x===ex.cx&&t.y===ex.cy;
        const flicker=0.7+Math.sin(time*20)*0.3;
        ctx.globalAlpha=alpha;
        ctx.fillStyle=`rgba(255,120,0,${0.85*flicker})`; ctx.fillRect(x+2,y+2,TILE-4,TILE-4);
        ctx.fillStyle=`rgba(255,240,60,${flicker})`;     ctx.fillRect(x+6,y+6,TILE-12,TILE-12);
        if (isCenter) { ctx.fillStyle=`rgba(255,255,200,${flicker})`; ctx.fillRect(x+9,y+9,TILE-18,TILE-18); }
        ctx.globalAlpha=1;
      }
    }
  }

  drawPowerups(powerups, time) {
    const ctx=this.ctx;
    for (const pu of powerups) {
      const x=pu.gx*TILE+4, y=pu.gy*TILE+4, s=TILE-8;
      const bob=Math.sin(time*4)*2;
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+1,y+1+bob,s,s);
      const [bg,fg,label] = pu.type==='b' ? ['#ffd740','#333','+B'] : pu.type==='r' ? ['#80deea','#004d40','+R'] : ['#a5d6a7','#1b5e20','+S'];
      ctx.fillStyle=bg; ctx.fillRect(x,y+bob,s,s);
      ctx.fillStyle=fg; ctx.font=`bold ${s-4}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(label,x+s/2,y+s/2+bob);
    }
  }

  drawPlayer(player, time, world) {
    if (!player.alive) return;
    const ctx=this.ctx;
    const x=player.px, y=player.py;
    const inv=player.invTimer>0 && Math.floor(time*8)%2===0;
    if (inv) return;

    const col = PLAYER_COLORS[player.slot] || PLAYER_COLORS[0];

    // Schatten
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x+TILE/2,y+TILE-3,TILE/2-3,4,0,0,Math.PI*2); ctx.fill();

    // Körper
    ctx.fillStyle=col.body; ctx.fillRect(x+5,y+12,TILE-10,TILE-14);
    // Kopf
    ctx.fillStyle=col.face; ctx.fillRect(x+4,y+3,TILE-8,12);
    // Helm
    ctx.fillStyle=col.helm; ctx.fillRect(x+4,y+2,TILE-8,4);

    // Augen
    ctx.fillStyle='#1a1a2e';
    if (player.facing===1)      { ctx.fillRect(x+5,y+7,3,3);  ctx.fillRect(x+10,y+7,3,3); }
    else if (player.facing===2) { ctx.fillRect(x+14,y+7,3,3); ctx.fillRect(x+19,y+7,3,3); }
    else                        { ctx.fillRect(x+7,y+7,3,3);  ctx.fillRect(x+16,y+7,3,3); }

    // Beine
    const legOff=Math.sin(time*12)*2;
    ctx.fillStyle=col.legs;
    ctx.fillRect(x+5,         y+TILE-8, 8, 6+legOff);
    ctx.fillRect(x+TILE-13, y+TILE-8, 8, 6-legOff);
  }

  drawEnemy(enemy, time, world) {
    if (!enemy.alive) return;
    const ctx=this.ctx;
    const x=enemy.px, y=enemy.py;
    const bob=Math.sin(time*5)*1.5;

    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x+TILE/2,y+TILE-3,TILE/2-3,4,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=world.enemyCol; ctx.fillRect(x+4,y+4+bob,TILE-8,TILE-6);
    ctx.fillStyle=world.enemyEye; ctx.fillRect(x+6,y+7+bob,5,5); ctx.fillRect(x+TILE-11,y+7+bob,5,5);
    ctx.fillStyle='#000'; ctx.fillRect(x+8,y+8+bob,2,3); ctx.fillRect(x+TILE-9,y+8+bob,2,3);
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(x+5,y+5+bob,6,2); ctx.fillRect(x+TILE-11,y+5+bob,6,2);
    ctx.fillStyle='#000'; ctx.fillRect(x+7,y+TILE-9+bob,TILE-14,3);
    const legA=Math.sin(time*8)*2;
    ctx.fillStyle=world.enemyCol;
    ctx.fillRect(x+5,         y+TILE-7,7,5+legA);
    ctx.fillRect(x+TILE-12, y+TILE-7,7,5-legA);
  }

  drawGameOverlay(phase, world, worldIdx, scores, myId) {
    const ctx=this.ctx;
    ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(0,0,CW,CH);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const blink = Math.floor(Date.now()/600)%2===0;

    if (phase===S_CLEAR) {
      ctx.fillStyle='#ffd740'; ctx.font='bold 28px "Courier New",monospace';
      ctx.fillText('LEVEL GESCHAFFT!', CW/2, CH/2-40);
      ctx.fillStyle='#a5d6a7'; ctx.font='16px "Courier New",monospace';
      const myScore = scores && myId ? (scores[myId]||0) : 0;
      ctx.fillText(`Score: ${myScore}`, CW/2, CH/2);
      if (worldIdx<2) { ctx.fillStyle='#80cbc4'; ctx.fillText(`Weiter: ${WORLDS[worldIdx+1].name}`, CW/2,CH/2+30); }
    } else if (phase===S_OVER) {
      ctx.fillStyle='#ff5252'; ctx.font='bold 36px "Courier New",monospace';
      ctx.fillText('GAME OVER', CW/2, CH/2-40);
      ctx.fillStyle='#fff'; ctx.font='16px "Courier New",monospace';
      const myScore = scores && myId ? (scores[myId]||0) : 0;
      ctx.fillText(`Score: ${myScore}`, CW/2, CH/2);
    } else if (phase===S_WIN) {
      ctx.fillStyle='#ffd740'; ctx.font='bold 28px "Courier New",monospace';
      ctx.fillText('GEWONNEN!', CW/2, CH/2-50);
      ctx.fillStyle='#a5d6a7'; ctx.font='16px "Courier New",monospace';
      ctx.fillText('Alle 3 Welten bezwungen!', CW/2, CH/2-15);
      const myScore = scores && myId ? (scores[myId]||0) : 0;
      ctx.fillStyle='#ffd740'; ctx.fillText(`Score: ${myScore}`, CW/2,CH/2+15);
    }

    if (blink && (phase===S_OVER||phase===S_WIN)) {
      ctx.fillStyle='#ffd740'; ctx.font='13px "Courier New",monospace';
      ctx.fillText('Tippen zum Neustart', CW/2, CH/2+55);
    }
  }

  drawWaitingScreen(worldIdx) {
    const world = WORLDS[worldIdx];
    this.clear(world);
    this.drawFloor(world);
    const ctx=this.ctx;
    ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle='#ffd740'; ctx.font='bold 20px "Courier New",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Warte auf Spieler...', CW/2, CH/2);
    const blink=Math.floor(Date.now()/600)%2===0;
    if (blink) { ctx.fillStyle='#80cbc4'; ctx.font='13px "Courier New",monospace'; ctx.fillText('Host tippt START um zu beginnen', CW/2, CH/2+30); }
  }
}

// ============================================================
// HAUPT-SPIELKLASSE – Koordiniert Client + Renderer + Input
// ============================================================
class BombermanGame {
  constructor(canvas) {
    this.canvas   = canvas;
    this.renderer = new Renderer(canvas.getContext('2d'));
    this.audio    = new AudioEngine();
    this.input    = new InputManager();

    // Server-State (wird per Socket empfangen)
    this.serverState = null;
    this._cachedMap  = null;  // Map wird nur bei Änderung gesendet
    this.time        = 0;
    this._lastTime   = 0;

    // Einstellungen (lokal gespeichert)
    this.settings = this._loadSettings();

    // Socket-Client
    this.client = new BombermanClient(this);

    this._setupCanvasTouch();
    this._setupJoystick();
    this._setupMenuHandlers();
    this._applySettingsToUI();
  }

  // ── Settings ───────────────────────────────────────────────

  _loadSettings() {
    try { return Object.assign({ speed:'normal', collectibles:'normal', selectedWorld:0 }, JSON.parse(localStorage.getItem('bomberman_settings'))); }
    catch(e) { return { speed:'normal', collectibles:'normal', selectedWorld:0 }; }
  }

  _saveSettings() { localStorage.setItem('bomberman_settings', JSON.stringify(this.settings)); }

  _applySettingsToUI() {
    document.querySelectorAll('.world-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.world)===this.settings.selectedWorld));
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b.dataset.speed===this.settings.speed));
    document.querySelectorAll('.coll-btn').forEach(b  => b.classList.toggle('active', b.dataset.coll===this.settings.collectibles));
  }

  // ── Socket-Callbacks (werden von BombermanClient aufgerufen) ──

  onRoomCreated(code) {
    if (this._soloMode) {
      // Solo: Server startet automatisch; nur Menü ausblenden
      this._soloMode = false;
      this._hideMainMenu();
      document.getElementById('btn-pause').classList.remove('hidden');
      return;
    }
    this._showLobbyOverlay(code, true);
    this._loadQR(code);
  }

  onRoomJoined(code) {
    this._showLobbyOverlay(code, false);
  }

  onJoinError(msg) {
    const el = document.getElementById('join-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  }

  onLobbyState(state) {
    this._updateLobbyPlayerList(state);
    // Einstellungen aus State übernehmen (für Nicht-Host)
    if (!this.client.isHost && state.settings) {
      this.settings.selectedWorld = state.settings.worldIdx || 0;
      this._applySettingsToUI();
    }
  }

  onGameStarted() {
    document.getElementById('lobby-overlay').classList.add('hidden');
    document.getElementById('btn-pause').classList.remove('hidden');
    this._hideMainMenu();
  }

  onPlayerLeft(id) {
    console.log('[Game] Spieler getrennt:', id);
  }

  applyServerState(state) {
    // Map nur speichern wenn mitgesendet
    if (state.map) this._cachedMap = state.map;
    state.map = this._cachedMap;
    this.serverState = state;

    // HUD aktualisieren
    this._updateHUD(state);

    // Endscreen bei game over
    if (state.phase === S_OVER || state.phase === S_WIN) {
      document.getElementById('btn-pause').classList.add('hidden');
    }
  }

  // ── Menu-Handler ──────────────────────────────────────────

  _setupMenuHandlers() {
    // Pause
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('touchstart', e => { e.preventDefault(); this._pause(); }, { passive:false });
      pauseBtn.addEventListener('mousedown', () => this._pause());
    }

    // Resume / Hauptmenü
    const resumeBtn = document.getElementById('btn-resume');
    const toMenuBtn = document.getElementById('btn-to-menu');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this._resume());
    if (toMenuBtn) toMenuBtn.addEventListener('click', () => this._goToMainMenu());

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        btn.classList.add('active');
        const tab = document.getElementById('tab-'+btn.dataset.tab);
        if (tab) tab.classList.remove('hidden');
      });
    });

    // Welt
    document.querySelectorAll('.world-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.selectedWorld = parseInt(btn.dataset.world);
        this._saveSettings();
        if (this.client.isHost) this.client.updateSettings({ worldIdx: this.settings.selectedWorld });
      });
    });

    // Geschwindigkeit
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.speed = btn.dataset.speed;
        this._saveSettings();
        if (this.client.isHost) this.client.updateSettings({ speed: this.settings.speed });
      });
    });

    // Collectibles
    document.querySelectorAll('.coll-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.coll-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.collectibles = btn.dataset.coll;
        this._saveSettings();
        if (this.client.isHost) this.client.updateSettings({ collectibles: this.settings.collectibles });
      });
    });

    // START GAME Button (erstellt Raum als Singleplayer oder Multiplayer)
    const startBtn = document.getElementById('btn-start-solo');
    if (startBtn) startBtn.addEventListener('click', () => this._startSolo());

    const multiBtn = document.getElementById('btn-start-multi');
    if (multiBtn) multiBtn.addEventListener('click', () => this._createRoom());

    // JOIN ROOM
    const joinBtn = document.getElementById('btn-join-room');
    if (joinBtn) joinBtn.addEventListener('click', () => this._showJoinOverlay());

    const joinConfirmBtn = document.getElementById('btn-join-confirm');
    if (joinConfirmBtn) joinConfirmBtn.addEventListener('click', () => this._joinRoom());

    const joinInput = document.getElementById('join-code-input');
    if (joinInput) joinInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._joinRoom();
    });

    // LOBBY Start-Button (nur für Host)
    const lobbyStartBtn = document.getElementById('btn-lobby-start');
    if (lobbyStartBtn) lobbyStartBtn.addEventListener('click', () => {
      this.client.startGame();
    });

    // LOBBY Verlassen
    const lobbyLeaveBtn = document.getElementById('btn-lobby-leave');
    if (lobbyLeaveBtn) lobbyLeaveBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  _pause() {
    if (!this.serverState || this.serverState.phase !== S_PLAY) return;
    document.getElementById('pause-overlay').classList.remove('hidden');
  }

  _resume() {
    document.getElementById('pause-overlay').classList.add('hidden');
  }

  _goToMainMenu() {
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('btn-pause').classList.add('hidden');
    document.getElementById('main-menu-overlay').classList.remove('hidden');
    this.serverState = null;
    // Seite neu laden um Socket-Verbindung sauber zu trennen
    setTimeout(() => window.location.reload(), 100);
  }

  _hideMainMenu() {
    document.getElementById('main-menu-overlay').classList.add('hidden');
  }

  _startSolo() {
    this._soloMode = true;
    this.client.createRoom({
      worldIdx:     this.settings.selectedWorld,
      speed:        this.settings.speed,
      collectibles: this.settings.collectibles,
    });
  }

  _createRoom() {
    this.client.createRoom({
      worldIdx:     this.settings.selectedWorld,
      speed:        this.settings.speed,
      collectibles: this.settings.collectibles,
    });
  }

  _showJoinOverlay() {
    document.getElementById('main-menu-overlay').classList.add('hidden');
    document.getElementById('join-overlay').classList.remove('hidden');
  }

  _joinRoom() {
    const input = document.getElementById('join-code-input');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (code.length !== 4) return;
    this.client.joinRoom(code);
  }

  _showLobbyOverlay(code, isHost) {
    document.getElementById('main-menu-overlay').classList.add('hidden');
    document.getElementById('join-overlay').classList.add('hidden');

    const overlay = document.getElementById('lobby-overlay');
    overlay.classList.remove('hidden');

    const codeEl = document.getElementById('lobby-code');
    if (codeEl) codeEl.textContent = code;

    const startBtn = document.getElementById('btn-lobby-start');
    if (startBtn) startBtn.style.display = isHost ? '' : 'none';

    // Solo-Start: Raum sofort starten
    if (isHost && this.client.socket && this.client.socket.connected) {
      const isSolo = this.settings._solo;
      if (isSolo) {
        setTimeout(() => this.client.startGame(), 300);
      }
    }
  }

  async _loadQR(code) {
    try {
      const res  = await fetch(`/api/qr/${code}`);
      const data = await res.json();
      const img  = document.getElementById('lobby-qr');
      if (img) {
        img.src = data.dataUrl;
        img.classList.remove('hidden');
      }
      const urlEl = document.getElementById('lobby-join-url');
      if (urlEl) urlEl.textContent = data.url;
    } catch(e) { console.warn('QR-Code konnte nicht geladen werden'); }
  }

  _updateLobbyPlayerList(state) {
    const list = document.getElementById('lobby-player-list');
    if (!list) return;
    const slotNames = ['Spieler 1 (Host)', 'Spieler 2', 'Spieler 3', 'Spieler 4'];
    const colorNames = ['Blau', 'Grün', 'Orange', 'Lila'];
    list.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const p = state.players && state.players.find(pl => pl.slot === i);
      const li = document.createElement('div');
      li.className = 'lobby-player-slot';
      li.innerHTML = p
        ? `<span class="slot-filled">&#9654; ${slotNames[i]} (${colorNames[i]})</span>`
        : `<span class="slot-empty">&#9675; ${slotNames[i]} – KI</span>`;
      list.appendChild(li);
    }
  }

  // ── HUD ──────────────────────────────────────────────────

  _updateHUD(state) {
    if (!state) return;
    const myPlayer = state.players && state.players.find(p => p.id === this.client.myId);
    const score = state.scores && this.client.myId ? (state.scores[this.client.myId] || 0) : 0;
    const lives = myPlayer ? myPlayer.lives : 0;

    const s = document.getElementById('hud-score');
    const l = document.getElementById('hud-lives');
    if (s) s.textContent = `${score} Pkt`;
    if (l) l.textContent = '\u2665'.repeat(Math.max(0, lives));
  }

  // ── Canvas-Touch ─────────────────────────────────────────

  _setupCanvasTouch() {
    const canvas = this.canvas;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.serverState && this.serverState.phase === S_PLAY) this._handlePlayTouch(e.touches[0]);
      else if (this.serverState && (this.serverState.phase === S_OVER || this.serverState.phase === S_WIN)) {
        this._goToMainMenu();
      }
    }, { passive:false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (this.serverState && this.serverState.phase === S_PLAY && e.touches.length>0) this._handlePlayTouch(e.touches[0]);
    }, { passive:false });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (this.serverState && this.serverState.phase === S_PLAY) this.input.clearTouchDirection();
    }, { passive:false });
    canvas.addEventListener('touchcancel', e => { e.preventDefault(); this.input.clearTouchDirection(); }, { passive:false });
    canvas.addEventListener('mousedown', () => {
      if (this.serverState && (this.serverState.phase === S_OVER || this.serverState.phase === S_WIN)) this._goToMainMenu();
    });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && this.serverState && this.serverState.phase === S_PLAY) this._pause();
      if (e.code === 'Enter' && this.serverState && (this.serverState.phase === S_OVER || this.serverState.phase === S_WIN)) this._goToMainMenu();
    });
  }

  _handlePlayTouch(touch) {
    const state = this.serverState;
    if (!state) return;
    const myPlayer = state.players && state.players.find(p => p.id === this.client.myId);
    if (!myPlayer) return;
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = CW / rect.width, scaleY = CH / rect.height;
    const tx     = (touch.clientX - rect.left) * scaleX;
    const ty     = (touch.clientY - rect.top)  * scaleY;
    const px     = myPlayer.px + TILE / 2, py = myPlayer.py + TILE / 2;
    const dx = tx - px, dy = ty - py;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    this.input.setTouchDirection(dx, dy);
  }

  // ── Joystick ──────────────────────────────────────────────

  _setupJoystick() {
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    if (!base || !knob) return;
    const MAX_DIST = 34;
    let active = false, centerX = 0, centerY = 0;

    const onStart = (cx,cy) => {
      const rect = base.getBoundingClientRect();
      centerX = rect.left + rect.width/2; centerY = rect.top + rect.height/2;
      active = true; onMove(cx,cy);
    };
    const onMove = (cx,cy) => {
      if (!active) return;
      const dx=cx-centerX, dy=cy-centerY;
      const dist=Math.sqrt(dx*dx+dy*dy), clamp=Math.min(dist,MAX_DIST);
      const angle=Math.atan2(dy,dx);
      knob.style.transform=`translate(calc(-50% + ${Math.cos(angle)*clamp}px), calc(-50% + ${Math.sin(angle)*clamp}px))`;
      if (this.serverState && this.serverState.phase===S_PLAY) this.input.setStickDirection(dx,dy);
    };
    const onEnd = () => { active=false; knob.style.transform='translate(-50%,-50%)'; this.input.clearStickDirection(); };

    base.addEventListener('touchstart', e => { e.preventDefault(); onStart(e.touches[0].clientX,e.touches[0].clientY); }, { passive:false });
    base.addEventListener('touchmove',  e => { e.preventDefault(); if(e.touches.length>0) onMove(e.touches[0].clientX,e.touches[0].clientY); }, { passive:false });
    base.addEventListener('touchend',   e => { e.preventDefault(); onEnd(); }, { passive:false });
    base.addEventListener('touchcancel',e => { e.preventDefault(); onEnd(); }, { passive:false });
  }

  // ── Render-Loop ───────────────────────────────────────────

  render() {
    const state   = this.serverState;
    const worldIdx = state ? state.worldIdx : 0;
    const world   = WORLDS[worldIdx];
    const r       = this.renderer;
    const t       = this.time;

    if (!state || state.phase === S_LOBBY) {
      r.drawWaitingScreen(worldIdx);
      return;
    }

    r.drawFloor(world);
    r.drawTiles(state.map, world);
    if (state.powerups) r.drawPowerups(state.powerups, t);
    if (state.bombs)    r.drawBombs(state.bombs, t);
    if (state.explosions) r.drawExplosions(state.explosions, t);

    // Alle Spieler rendern
    if (state.players) {
      for (const p of state.players) r.drawPlayer(p, t, world);
    }
    // KI-Gegner rendern
    if (state.enemies) {
      for (const e of state.enemies) r.drawEnemy(e, t, world);
    }

    if (state.phase === S_CLEAR || state.phase === S_OVER || state.phase === S_WIN) {
      r.drawGameOverlay(state.phase, world, worldIdx, state.scores, this.client.myId);
    }
  }

  loop(ts) {
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;
    this.time += dt;

    // Input an Server senden (nur wenn Spiel läuft)
    if (this.serverState && this.serverState.phase === S_PLAY) {
      this.client.sendInput(this.input.dir, this.input.bomb);
    }

    this.render();
    requestAnimationFrame(ts => this.loop(ts));
  }

  start() {
    this.audio.init();
    this.client.connect();
    requestAnimationFrame(ts => { this._lastTime = ts; this.loop(ts); });
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
