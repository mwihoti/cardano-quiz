import { nanoid } from "nanoid";
import { QUESTIONS, type Question } from "./questions.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Member {
  id: string;        // socket id
  name: string;
  walletAddress?: string;
  currentVote?: string;
  isLeader: boolean;
}

export interface Room {
  code: string;
  gameId: string;
  name: string;
  members: Member[];
  score: number;
  currentVotes: Record<string, string>;   // memberId → option
  lockedAnswer?: string;
  answeredAt: Record<number, { locked: string; correct: boolean; points: number }>;
}

export interface Game {
  id: string;
  code: string;
  hostId: string;  // socket id of host
  status: "lobby" | "active" | "question" | "review" | "finished";
  currentQuestionIndex: number;
  questions: Question[];
  rooms: Map<string, Room>;
  createdAt: Date;
}

// ─── In-memory stores ─────────────────────────────────────────────────────────

const games = new Map<string, Game>();
const roomToGameId = new Map<string, string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function pickQuestions(count = 15): Question[] {
  return [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, count);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createGame(hostId: string): Game {
  const id = nanoid(10);
  const code = shortCode(6);
  const game: Game = {
    id,
    code,
    hostId,
    status: "lobby",
    currentQuestionIndex: -1,
    questions: pickQuestions(15),
    rooms: new Map(),
    createdAt: new Date(),
  };
  games.set(id, game);
  return game;
}

export function getGame(id: string): Game | undefined {
  return games.get(id);
}

export function getGameByCode(code: string): Game | undefined {
  return [...games.values()].find((g) => g.code === code.toUpperCase());
}

export function getGameByRoomCode(roomCode: string): Game | undefined {
  const gameId = roomToGameId.get(roomCode);
  return gameId ? games.get(gameId) : undefined;
}

export function createRoom(gameId: string, roomName: string, leader: Member): Room | null {
  const game = games.get(gameId);
  if (!game || game.status !== "lobby") return null;

  const code = shortCode(4);
  const room: Room = {
    code,
    gameId,
    name: roomName.trim() || `Team ${code}`,
    members: [leader],
    score: 0,
    currentVotes: {},
    answeredAt: {},
  };
  game.rooms.set(code, room);
  roomToGameId.set(code, gameId);
  return room;
}

export function joinRoom(roomCode: string, member: Member): { room: Room; game: Game } | null {
  const game = getGameByRoomCode(roomCode);
  const room = game?.rooms.get(roomCode);
  if (!room || !game) return null;

  const existing = room.members.findIndex((m) => m.id === member.id);
  if (existing >= 0) {
    room.members[existing] = { ...room.members[existing], ...member };
  } else {
    room.members.push(member);
  }
  return { room, game };
}

export function removeMember(socketId: string): void {
  games.forEach((game) => {
    game.rooms.forEach((room) => {
      const idx = room.members.findIndex((m) => m.id === socketId);
      if (idx >= 0) {
        room.members.splice(idx, 1);
      }
    });
  });
}

export function recordVote(roomCode: string, questionIndex: number, memberId: string, vote: string): Room | null {
  const game = getGameByRoomCode(roomCode);
  const room = game?.rooms.get(roomCode);
  if (!room || game?.currentQuestionIndex !== questionIndex) return null;

  room.currentVotes[memberId] = vote;
  const member = room.members.find((m) => m.id === memberId);
  if (member) member.currentVote = vote;
  return room;
}

export function lockAnswer(
  roomCode: string,
  questionIndex: number,
  answer: string
): { room: Room; game: Game; correct: boolean; points: number } | null {
  const game = getGameByRoomCode(roomCode);
  const room = game?.rooms.get(roomCode);
  if (!room || !game) return null;
  if (room.lockedAnswer !== undefined) return null; // already locked

  const question = game.questions[questionIndex];
  const correct = answer === question.correct;
  const points = correct ? question.points : 0;

  room.lockedAnswer = answer;
  room.answeredAt[questionIndex] = { locked: answer, correct, points };
  if (correct) room.score += points;

  // clear per-member votes so they're fresh next round
  room.currentVotes = {};
  room.members.forEach((m) => (m.currentVote = undefined));

  return { room, game, correct, points };
}

export function startGame(gameId: string): Game | null {
  const game = games.get(gameId);
  if (!game) return null;
  game.status = "active";
  return game;
}

export function nextQuestion(gameId: string): { game: Game; question: Question | null; finished: boolean } | null {
  const game = games.get(gameId);
  if (!game) return null;

  game.currentQuestionIndex++;

  if (game.currentQuestionIndex >= game.questions.length) {
    game.status = "finished";
    return { game, question: null, finished: true };
  }

  game.status = "question";

  // reset room state for the new question
  game.rooms.forEach((room) => {
    room.lockedAnswer = undefined;
    room.currentVotes = {};
    room.members.forEach((m) => (m.currentVote = undefined));
  });

  return { game, question: game.questions[game.currentQuestionIndex], finished: false };
}

export function getLeaderboard(gameId: string): Array<{ rank: number; name: string; score: number; members: Member[]; code: string }> {
  const game = games.get(gameId);
  if (!game) return [];

  return [...game.rooms.values()]
    .sort((a, b) => b.score - a.score)
    .map((room, idx) => ({
      rank: idx + 1,
      name: room.name,
      score: room.score,
      members: room.members,
      code: room.code,
    }));
}

export function getRoomList(gameId: string): RoomSummary[] {
  const game = games.get(gameId);
  if (!game) return [];

  return [...game.rooms.values()].map((room) => {
    const voteCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    Object.values(room.currentVotes).forEach((v: string) => {
      if (v in voteCounts) voteCounts[v]++;
    });
    return {
      code: room.code,
      name: room.name,
      memberCount: room.members.length,
      score: room.score,
      lockedAnswer: room.lockedAnswer,
      voteCounts,
      members: room.members.map((m) => ({ id: m.id, name: m.name, vote: m.currentVote, isLeader: m.isLeader })),
    };
  });
}

export interface RoomSummary {
  code: string;
  name: string;
  memberCount: number;
  score: number;
  lockedAnswer?: string;
  voteCounts: Record<string, number>;
  members: Array<{ id: string; name: string; vote?: string; isLeader: boolean }>;
}
