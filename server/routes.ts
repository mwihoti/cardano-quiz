import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as GM from "./gameManager.js";
import { batchMintNfts, isNmkrConfigured, getNmkrStatus } from "./nft.js";

// ─── WebSocket message types ──────────────────────────────────────────────────

type Msg =
  | { type: "CREATE_GAME" }
  | { type: "CREATE_ROOM"; gameCode: string; roomName: string; leaderName: string; walletAddress?: string }
  | { type: "JOIN_ROOM"; roomCode: string; name: string; walletAddress?: string }
  | { type: "VOTE"; roomCode: string; questionIndex: number; vote: string }
  | { type: "LOCK_ANSWER"; roomCode: string; questionIndex: number; answer: string }
  | { type: "START_GAME"; gameId: string }
  | { type: "NEXT_QUESTION"; gameId: string }
  | { type: "END_GAME"; gameId: string }
  | { type: "GET_STATE"; roomCode?: string; gameId?: string };

// ─── Connection registry ──────────────────────────────────────────────────────

const clients = new Map<string, WebSocket>(); // socketId → ws
let nextId = 1;
function makeId() { return `s${nextId++}`; }

// socket → gameId & roomCode for cleanup
const socketMeta = new Map<string, { gameId?: string; roomCode?: string; isHost?: boolean }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(ws: WebSocket, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(socketIds: string[], payload: object) {
  for (const id of socketIds) {
    const ws = clients.get(id);
    if (ws) send(ws, payload);
  }
}

function getRoomSocketIds(game: GM.Game, roomCode: string): string[] {
  return game.rooms.get(roomCode)?.members.map((m) => m.id) ?? [];
}

function getAllGameSocketIds(game: GM.Game): string[] {
  const ids: string[] = [];
  game.rooms.forEach((room) => room.members.forEach((m) => ids.push(m.id)));
  return ids;
}

function notifyHost(game: GM.Game, payload: object) {
  const ws = clients.get(game.hostId);
  if (ws) send(ws, payload);
}

function notifyHostById(hostId: string, payload: object) {
  const ws = clients.get(hostId);
  if (ws) send(ws, payload);
}

function pushRoomListToHost(game: GM.Game) {
  notifyHost(game, { type: "ROOMS_UPDATE", rooms: GM.getRoomList(game.id) });
}

function safeQuestion(q: GM.Game["questions"][number]) {
  return { id: q.id, category: q.category, question: q.question, options: q.options, points: q.points, timeLimit: q.timeLimit };
}

// ─── Admin auth helper ────────────────────────────────────────────────────────

const ADMIN_PIN = process.env.ADMIN_PIN || "cardano2026";

function requireAdmin(req: Request, res: Response): boolean {
  const pin = req.headers["x-admin-pin"] as string | undefined;
  if (pin !== ADMIN_PIN) {
    res.status(401).json({ error: "Invalid admin PIN" });
    return false;
  }
  return true;
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerRoutes(httpServer: Server, app: Express) {
  // ── Admin REST API ──────────────────────────────────────────────────────────

  // Verify PIN
  app.post("/api/admin/auth", (req: Request, res: Response) => {
    const { pin } = req.body;
    if (pin === ADMIN_PIN) res.json({ ok: true });
    else res.status(401).json({ error: "Invalid PIN" });
  });

  // List all games
  app.get("/api/admin/games", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    res.json({ games: GM.getAllGames() });
  });

  // Full game detail (rooms + members)
  app.get("/api/admin/games/:gameId", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const gameId = req.params["gameId"] as string;
    const game = GM.getGame(gameId);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    res.json({ rooms: GM.getRoomList(game.id), status: game.status, code: game.code, currentQuestionIndex: game.currentQuestionIndex });
  });

  // Reset a game (back to lobby, wipes scores, keeps rooms)
  app.post("/api/admin/games/:gameId/reset", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const gameId = req.params["gameId"] as string;
    const game = GM.resetGame(gameId);
    if (!game) { res.status(404).json({ error: "Game not found" }); return; }
    const everyone = [...game.rooms.values()].flatMap((r) => r.members.map((m) => m.id));
    everyone.forEach((id) => {
      const ws = clients.get(id);
      if (ws) send(ws, { type: "GAME_RESET", message: "The host has reset the game." });
    });
    notifyHostById(game.hostId, { type: "GAME_RESET", message: "Game reset." });
    res.json({ ok: true });
  });

  // Delete a game entirely
  app.delete("/api/admin/games/:gameId", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const gameId = req.params["gameId"] as string;
    const game = GM.getGame(gameId);
    if (game) {
      const everyone = [...game.rooms.values()].flatMap((r) => r.members.map((m) => m.id));
      everyone.forEach((id) => {
        const ws = clients.get(id);
        if (ws) send(ws, { type: "GAME_DELETED", message: "This session has been closed." });
      });
    }
    const ok = GM.deleteGame(gameId);
    res.json({ ok });
  });

  // Reset a single room's scores
  app.post("/api/admin/games/:gameId/rooms/:roomCode/reset", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const gameId = req.params["gameId"] as string;
    const roomCode = req.params["roomCode"] as string;
    const room = GM.resetRoom(gameId, roomCode);
    if (!room) { res.status(404).json({ error: "Room not found" }); return; }
    const game = GM.getGame(gameId)!;
    room.members.forEach((m) => {
      const ws = clients.get(m.id);
      if (ws) send(ws, { type: "ROOM_RESET", message: "Your room score has been reset by admin." });
    });
    notifyHostById(game.hostId, { type: "ROOMS_UPDATE", rooms: GM.getRoomList(game.id) });
    res.json({ ok: true });
  });

  // Delete a room
  app.delete("/api/admin/games/:gameId/rooms/:roomCode", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const gameId = req.params["gameId"] as string;
    const roomCode = req.params["roomCode"] as string;
    const game = GM.getGame(gameId);
    const room = game?.rooms.get(roomCode);
    if (room) {
      room.members.forEach((m) => {
        const ws = clients.get(m.id);
        if (ws) send(ws, { type: "GAME_DELETED", message: "Your room has been removed by the admin." });
      });
    }
    const ok = GM.deleteRoom(gameId, roomCode);
    if (game) notifyHostById(game.hostId, { type: "ROOMS_UPDATE", rooms: GM.getRoomList(game.id) });
    res.json({ ok });
  });

  // Kick a member
  app.delete("/api/admin/members/:socketId", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const socketId = req.params["socketId"] as string;
    const ws = clients.get(socketId);
    if (ws) send(ws, { type: "KICKED", message: "You have been removed by the admin." });
    const result = GM.kickMember(socketId);
    if (result) {
      const game = GM.getGame(result.gameId);
      if (game) notifyHostById(game.hostId, { type: "ROOMS_UPDATE", rooms: GM.getRoomList(game.id) });
    }
    res.json({ ok: !!result });
  });

  // ── NFT endpoints ───────────────────────────────────────────────────────────

  // Check if NMKR is configured
  app.get("/api/admin/nft/status", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    res.json(getNmkrStatus());
  });

  // Mint participation NFTs to a list of wallet addresses
  // Body: { addresses: [{ recordId: string, wallet: string, name: string }] }
  app.post("/api/admin/nft/mint", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const { addresses } = req.body as {
      addresses: Array<{ recordId: string; wallet: string; name: string }>;
    };

    if (!Array.isArray(addresses) || addresses.length === 0) {
      res.status(400).json({ error: "No addresses provided" });
      return;
    }

    if (!isNmkrConfigured()) {
      res.status(503).json({ error: "NMKR_API_KEY or NMKR_PROJECT_UID not configured on server" });
      return;
    }

    // Run minting — results returned as they complete
    const wallets = addresses.map((a) => a.wallet);
    const mintResults = await batchMintNfts(wallets);

    // Map results back to recordIds so client can update Airtable
    const results = addresses.map((a, i) => ({
      recordId: a.recordId,
      name: a.name,
      wallet: a.wallet,
      success: mintResults[i].success,
      txHash: mintResults[i].txHash,
      error: mintResults[i].error,
    }));

    res.json({ results });
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    const socketId = makeId();
    clients.set(socketId, ws);
    socketMeta.set(socketId, {});
    send(ws, { type: "CONNECTED", socketId });

    ws.on("message", (raw) => {
      let msg: Msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { return; }

      const meta = socketMeta.get(socketId)!;

      switch (msg.type) {
        // ── Host: create a new game session ────────────────────────────────
        case "CREATE_GAME": {
          const game = GM.createGame(socketId);
          meta.gameId = game.id;
          meta.isHost = true;
          send(ws, {
            type: "GAME_CREATED",
            game: { id: game.id, code: game.code, status: game.status },
          });
          break;
        }

        // ── Leader: create a room inside a game ────────────────────────────
        case "CREATE_ROOM": {
          const game = GM.getGameByCode(msg.gameCode);
          if (!game) { send(ws, { type: "ERROR", message: "Game not found. Check the game code." }); break; }

          const leader: GM.Member = { id: socketId, name: msg.leaderName, walletAddress: msg.walletAddress, isLeader: true };
          const room = GM.createRoom(game.id, msg.roomName, leader);
          if (!room) { send(ws, { type: "ERROR", message: "Could not create room. Game may have already started." }); break; }

          meta.gameId = game.id;
          meta.roomCode = room.code;

          send(ws, {
            type: "ROOM_CREATED",
            room: { code: room.code, name: room.name, members: room.members },
            gameId: game.id,
          });
          pushRoomListToHost(game);
          break;
        }

        // ── Member: join a room ────────────────────────────────────────────
        case "JOIN_ROOM": {
          const result = GM.joinRoom(msg.roomCode.toUpperCase(), {
            id: socketId,
            name: msg.name,
            walletAddress: msg.walletAddress,
            isLeader: false,
          });
          if (!result) { send(ws, { type: "ERROR", message: "Room not found. Check the room code." }); break; }

          meta.gameId = result.game.id;
          meta.roomCode = result.room.code;

          const currentQ = result.game.currentQuestionIndex >= 0
            ? safeQuestion(result.game.questions[result.game.currentQuestionIndex])
            : null;

          send(ws, {
            type: "JOINED_ROOM",
            room: { code: result.room.code, name: result.room.name, members: result.room.members },
            gameStatus: result.game.status,
            currentQuestionIndex: result.game.currentQuestionIndex,
            currentQuestion: currentQ,
            totalQuestions: result.game.questions.length,
          });

          // Notify other room members
          const roomIds = getRoomSocketIds(result.game, result.room.code).filter((id) => id !== socketId);
          broadcast(roomIds, {
            type: "MEMBER_JOINED",
            member: { id: socketId, name: msg.name, walletAddress: msg.walletAddress, isLeader: false },
            members: result.room.members,
          });

          pushRoomListToHost(result.game);
          break;
        }

        // ── Member: vote for an answer ─────────────────────────────────────
        case "VOTE": {
          const room = GM.recordVote(msg.roomCode, msg.questionIndex, socketId, msg.vote);
          if (!room) break;

          const game = GM.getGameByRoomCode(msg.roomCode)!;
          const voteCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
          Object.values(room.currentVotes).forEach((v) => { if (v in voteCounts) voteCounts[v]++; });

          broadcast(getRoomSocketIds(game, room.code), {
            type: "VOTE_UPDATE",
            voteCounts,
            memberId: socketId,
            vote: msg.vote,
            totalVotes: Object.keys(room.currentVotes).length,
            totalMembers: room.members.length,
          });

          pushRoomListToHost(game);
          break;
        }

        // ── Leader: lock the group's final answer ──────────────────────────
        case "LOCK_ANSWER": {
          const result = GM.lockAnswer(msg.roomCode, msg.questionIndex, msg.answer);
          if (!result) break;

          const { room, game, correct, points } = result;
          const q = game.questions[msg.questionIndex];

          broadcast(getRoomSocketIds(game, room.code), {
            type: "ANSWER_LOCKED",
            answer: msg.answer,
            correct,
            correctAnswer: q.correct,
            explanation: q.explanation,
            points,
            totalScore: room.score,
          });

          pushRoomListToHost(game);
          notifyHost(game, { type: "ROOMS_UPDATE", rooms: GM.getRoomList(game.id) });
          break;
        }

        // ── Host: start the game ───────────────────────────────────────────
        case "START_GAME": {
          const game = GM.startGame(msg.gameId);
          if (!game) break;

          const everyone = getAllGameSocketIds(game);
          broadcast(everyone, { type: "GAME_STARTED", totalQuestions: game.questions.length });
          send(ws, { type: "GAME_STARTED", totalQuestions: game.questions.length });
          pushRoomListToHost(game);
          break;
        }

        // ── Host: next question ────────────────────────────────────────────
        case "NEXT_QUESTION": {
          const result = GM.nextQuestion(msg.gameId);
          if (!result) break;

          const { game, question, finished } = result;

          if (finished) {
            const leaderboard = GM.getLeaderboard(game.id);
            const everyone = getAllGameSocketIds(game);
            broadcast(everyone, { type: "GAME_FINISHED", leaderboard });
            send(ws, { type: "GAME_FINISHED", leaderboard });
            break;
          }

          const everyone = getAllGameSocketIds(game);
          const qPayload = {
            type: "QUESTION_STARTED",
            questionIndex: game.currentQuestionIndex,
            question: safeQuestion(question!),
            timeLimit: question!.timeLimit,
            totalQuestions: game.questions.length,
          };
          broadcast(everyone, qPayload);
          send(ws, qPayload);
          pushRoomListToHost(game);
          break;
        }

        // ── Host: end game early ───────────────────────────────────────────
        case "END_GAME": {
          const game = GM.getGame(msg.gameId);
          if (!game) break;
          const leaderboard = GM.getLeaderboard(game.id);
          const everyone = getAllGameSocketIds(game);
          broadcast(everyone, { type: "GAME_FINISHED", leaderboard });
          send(ws, { type: "GAME_FINISHED", leaderboard });
          break;
        }

        // ── Reconnect state fetch ──────────────────────────────────────────
        case "GET_STATE": {
          if (msg.roomCode) {
            const game = GM.getGameByRoomCode(msg.roomCode);
            const room = game?.rooms.get(msg.roomCode);
            if (!room || !game) { send(ws, { type: "ERROR", message: "Room not found" }); break; }
            send(ws, {
              type: "STATE_SNAPSHOT",
              room: { code: room.code, name: room.name, members: room.members, score: room.score },
              gameStatus: game.status,
              currentQuestionIndex: game.currentQuestionIndex,
              currentQuestion: game.currentQuestionIndex >= 0 ? safeQuestion(game.questions[game.currentQuestionIndex]) : null,
              totalQuestions: game.questions.length,
            });
          } else if (msg.gameId) {
            const game = GM.getGame(msg.gameId);
            if (!game) { send(ws, { type: "ERROR", message: "Game not found" }); break; }
            send(ws, {
              type: "HOST_STATE",
              game: { id: game.id, code: game.code, status: game.status },
              rooms: GM.getRoomList(game.id),
              currentQuestionIndex: game.currentQuestionIndex,
              totalQuestions: game.questions.length,
            });
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      const meta = socketMeta.get(socketId);
      if (meta?.roomCode) {
        GM.removeMember(socketId);
        const game = meta.gameId ? GM.getGame(meta.gameId) : undefined;
        if (game) {
          const room = game.rooms.get(meta.roomCode);
          if (room) {
            broadcast(getRoomSocketIds(game, meta.roomCode), {
              type: "MEMBER_LEFT",
              memberId: socketId,
              members: room.members,
            });
          }
          pushRoomListToHost(game);
        }
      }
      clients.delete(socketId);
      socketMeta.delete(socketId);
    });
  });
}
