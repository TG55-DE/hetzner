'use strict';

// ============================================================
// ROOM MANAGER – Registry aller aktiven Spielräume
// ============================================================
const GameRoom = require('./gameRoom');

const rooms = new Map(); // code → GameRoom

// Welcher Socket ist in welchem Raum?
const socketToRoom = new Map(); // socketId → roomCode

// ── Raum-Code generieren (4 Buchstaben, leicht tippbar) ──────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // ohne I/O (Verwechslungsgefahr)
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// ── Raum erstellen ───────────────────────────────────────────
function createRoom(hostSocketId, settings) {
  // Alten Raum verlassen falls vorhanden
  _leaveCurrentRoom(hostSocketId);

  const code = generateCode();
  const room = new GameRoom(code, hostSocketId, settings);
  room.addPlayer(hostSocketId);
  rooms.set(code, room);
  socketToRoom.set(hostSocketId, code);
  return room;
}

// ── Raum beitreten ───────────────────────────────────────────
function joinRoom(code, socketId) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Raum nicht gefunden' };
  if (room.phase !== 'lobby') return { error: 'Spiel läuft bereits' };
  if (room.playerCount() >= 4) return { error: 'Raum ist voll' };

  _leaveCurrentRoom(socketId);

  const player = room.addPlayer(socketId);
  if (!player) return { error: 'Raum ist voll' };

  socketToRoom.set(socketId, code.toUpperCase());
  return { room, player };
}

// ── Spieler entfernen ────────────────────────────────────────
function removePlayer(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;

  const room = rooms.get(code);
  if (room) {
    room.removePlayer(socketId);
    // Leeren Raum aufräumen
    if (room.playerCount() === 0) {
      room.stopTick();
      rooms.delete(code);
    }
  }
  socketToRoom.delete(socketId);
  return room;
}

// ── Raum abrufen ────────────────────────────────────────────
function getRoom(code) {
  return rooms.get(code ? code.toUpperCase() : '') || null;
}

function getRoomBySocket(socketId) {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : null;
}

// ── Intern ─────────────────────────────────────────────────
function _leaveCurrentRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return;
  const room = rooms.get(code);
  if (room) {
    room.removePlayer(socketId);
    if (room.playerCount() === 0) {
      room.stopTick();
      rooms.delete(code);
    }
  }
  socketToRoom.delete(socketId);
}

module.exports = {
  createRoom,
  joinRoom,
  removePlayer,
  getRoom,
  getRoomBySocket,
};
