import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, RefreshCw, Trash2, UserX, ChevronDown, ChevronRight,
  AlertTriangle, LogOut, Database, Image as ImageIcon,
  CheckCircle2, XCircle, Loader2, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatScore, shortenAddress } from "@/lib/utils";
import {
  getPastResults, getResultsByDate,
  getPlayersByDate, getPendingNftPlayers,
  markNftSent
} from "@/lib/airtable";
import type { AirtableResult, AirtablePlayer } from "@/lib/airtable";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameSummary {
  id: string; code: string; status: string;
  roomCount: number; totalPlayers: number; createdAt: string;
}

interface RoomDetail {
  code: string; name: string; memberCount: number; score: number;
  lockedAnswer?: string; voteCounts: Record<string, number>;
  members: Array<{ id: string; name: string; vote?: string; isLeader: boolean }>;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function adminFetch(url: string, options: RequestInit = {}) {
  const pin = sessionStorage.getItem("admin_pin") ?? "";
  return fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", "x-admin-pin": pin, ...options.headers },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = "live" | "players" | "history";

interface NftMintStatus {
  recordId: string;
  name: string;
  wallet: string;
  state: "pending" | "minting" | "done" | "error";
  txHash?: string;
  error?: string;
}

export default function Admin() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("admin_pin"));
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("live");

  // Live tab state
  const [games, setGames] = useState<GameSummary[]>([]);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Record<string, RoomDetail[]>>({});
  const [loading, setLoading] = useState(false);

  // History tab state
  const [history, setHistory] = useState<AirtableResult[]>([]);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split("T")[0]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Players / NFT tab state
  const [players, setPlayers] = useState<AirtablePlayer[]>([]);
  const [playersDate, setPlayersDate] = useState(new Date().toISOString().split("T")[0]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [nmkrConfigured, setNmkrConfigured] = useState(false);
  const [nmkrNetwork, setNmkrNetwork] = useState<string>("preprod");
  const [nftStatuses, setNftStatuses] = useState<Record<string, NftMintStatus>>({});
  const [minting, setMinting] = useState(false);

  async function login() {
    setAuthError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      sessionStorage.setItem("admin_pin", pin);
      setAuthed(true);
    } else {
      setAuthError("Wrong PIN. Ask the host.");
    }
  }

  function logout() {
    sessionStorage.removeItem("admin_pin");
    setAuthed(false);
    setPin("");
  }

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/games");
      if (res.ok) {
        const data = await res.json();
        setGames(data.games);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRooms = useCallback(async (gameId: string) => {
    const res = await adminFetch(`/api/admin/games/${gameId}`);
    if (res.ok) {
      const data = await res.json();
      setRooms((prev) => ({ ...prev, [gameId]: data.rooms }));
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const results = historyDate
        ? await getResultsByDate(historyDate)
        : await getPastResults();
      setHistory(results);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDate]);

  const fetchPlayers = useCallback(async () => {
    setPlayersLoading(true);
    try {
      const data = playersDate
        ? await getPlayersByDate(playersDate)
        : await getPendingNftPlayers();
      setPlayers(data);
      // Init NFT statuses
      const statuses: Record<string, NftMintStatus> = {};
      data.forEach((p) => {
        statuses[p.id] = {
          recordId: p.id,
          name: p.fields["Name"],
          wallet: p.fields["Wallet Address"],
          state: p.fields["NFT Sent"] ? "done" : "pending",
          txHash: p.fields["NFT Tx Hash"] || undefined,
        };
      });
      setNftStatuses(statuses);
    } finally {
      setPlayersLoading(false);
    }
  }, [playersDate]);

  const checkNmkr = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/nft/status");
      if (res.ok) { const d = await res.json(); setNmkrConfigured(d.configured); setNmkrNetwork(d.network ?? "preprod"); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (authed && tab === "live") fetchGames(); }, [authed, tab, fetchGames]);
  useEffect(() => { if (authed && tab === "history") fetchHistory(); }, [authed, tab, fetchHistory]);
  useEffect(() => { if (authed && tab === "players") { fetchPlayers(); checkNmkr(); } }, [authed, tab, fetchPlayers, checkNmkr]);

  async function resetGame(gameId: string) {
    if (!confirm("Reset this game? Scores cleared, rooms kept.")) return;
    const res = await adminFetch(`/api/admin/games/${gameId}/reset`, { method: "POST" });
    if (res.ok) { toast.success("Game reset"); fetchGames(); if (expandedGame === gameId) fetchRooms(gameId); }
    else toast.error("Failed to reset");
  }

  async function deleteGame(gameId: string) {
    if (!confirm("Delete this entire game session?")) return;
    const res = await adminFetch(`/api/admin/games/${gameId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Game deleted"); fetchGames(); setExpandedGame(null); }
    else toast.error("Failed to delete");
  }

  async function resetRoom(gameId: string, roomCode: string) {
    const res = await adminFetch(`/api/admin/games/${gameId}/rooms/${roomCode}/reset`, { method: "POST" });
    if (res.ok) { toast.success(`Room ${roomCode} reset`); fetchRooms(gameId); }
    else toast.error("Failed");
  }

  async function deleteRoom(gameId: string, roomCode: string) {
    if (!confirm(`Remove room ${roomCode}?`)) return;
    const res = await adminFetch(`/api/admin/games/${gameId}/rooms/${roomCode}`, { method: "DELETE" });
    if (res.ok) { toast.success("Room removed"); fetchRooms(gameId); fetchGames(); }
    else toast.error("Failed");
  }

  async function kickMember(socketId: string, name: string) {
    if (!confirm(`Kick ${name}?`)) return;
    const res = await adminFetch(`/api/admin/members/${socketId}`, { method: "DELETE" });
    if (res.ok) { toast.success(`${name} kicked`); games.forEach((g) => fetchRooms(g.id)); }
    else toast.error("Failed");
  }

  async function mintNfts(onlyPending = true) {
    const targets = players.filter((p) => {
      const s = nftStatuses[p.id];
      return p.fields["Wallet Address"] && (onlyPending ? s?.state === "pending" : true);
    });

    if (targets.length === 0) { toast.info("No pending wallets to send NFTs to"); return; }
    if (!confirm(`Send participation NFTs to ${targets.length} player(s)?`)) return;

    setMinting(true);

    // Mark all as minting
    setNftStatuses((prev) => {
      const next = { ...prev };
      targets.forEach((p) => { next[p.id] = { ...next[p.id], state: "minting" }; });
      return next;
    });

    try {
      const res = await adminFetch("/api/admin/nft/mint", {
        method: "POST",
        body: JSON.stringify({
          addresses: targets.map((p) => ({
            recordId: p.id,
            wallet: p.fields["Wallet Address"],
            name: p.fields["Name"],
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Minting failed");
        setMinting(false);
        return;
      }

      const { results } = await res.json() as {
        results: Array<{ recordId: string; name: string; success: boolean; txHash?: string; error?: string }>;
      };

      // Update statuses and mark sent in Airtable
      const updates: Record<string, NftMintStatus> = {};
      for (const r of results) {
        updates[r.recordId] = {
          recordId: r.recordId,
          name: r.name,
          wallet: targets.find((p) => p.id === r.recordId)?.fields["Wallet Address"] ?? "",
          state: r.success ? "done" : "error",
          txHash: r.txHash,
          error: r.error,
        };
        if (r.success && r.txHash) {
          await markNftSent(r.recordId, r.txHash);
        }
      }

      setNftStatuses((prev) => ({ ...prev, ...updates }));
      const sent = results.filter((r) => r.success).length;
      const failed = results.length - sent;
      if (sent > 0) toast.success(`${sent} NFT(s) sent!`);
      if (failed > 0) toast.error(`${failed} failed — check console`);
    } finally {
      setMinting(false);
    }
  }

  // ── Login screen ─────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-2">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-black">Admin Access</h1>
            <p className="text-sm text-muted-foreground">Enter the admin PIN to continue</p>
          </div>
          <div className="card-glass rounded-2xl p-6 space-y-4">
            <Input
              type="password"
              placeholder="Admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              className="text-center font-mono text-xl tracking-widest"
              autoFocus
            />
            {authError && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {authError}
              </div>
            )}
            <Button onClick={login} size="lg" className="w-full">Enter</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Admin panel ───────────────────────────────────────────────────────────

  const statusColor: Record<string, string> = {
    lobby: "text-amber-400 bg-amber-400/10",
    active: "text-blue-400 bg-blue-400/10",
    question: "text-primary bg-primary/10 animate-pulse",
    finished: "text-green-400 bg-green-400/10",
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/80 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="font-bold text-white text-sm">Admin Panel</span>
            <span className="text-xs text-muted-foreground">· Cardano NBO Quiz</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchGames} variant="ghost" size="sm">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button onClick={logout} variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/5">
          {[
            { id: "live" as Tab, label: "Live Games", icon: Shield },
            { id: "players" as Tab, label: "Players & NFTs", icon: ImageIcon },
            { id: "history" as Tab, label: "Results History", icon: Database },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* ── LIVE GAMES ─────────────────────────────────────────────────── */}

        {tab === "live" && (
          <>
            {loading && games.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground text-sm">Loading...</div>
            ) : games.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p>No active game sessions.</p>
                <p className="text-xs mt-1">Create a game from the Host page.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {games.map((game) => (
                  <div key={game.id} className="card-glass rounded-xl overflow-hidden border border-white/5">
                    {/* Game header */}
                    <div className="flex items-center gap-4 p-4">
                      <button
                        onClick={() => {
                          if (expandedGame === game.id) { setExpandedGame(null); return; }
                          setExpandedGame(game.id);
                          fetchRooms(game.id);
                        }}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        {expandedGame === game.id
                          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        }
                        <span className="font-mono font-black text-primary text-lg">{game.code}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", statusColor[game.status] ?? "text-muted-foreground bg-white/5")}>
                          {game.status}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {game.roomCount} rooms · {game.totalPlayers} players
                        </span>
                      </button>
                      <div className="flex gap-2 shrink-0">
                        <Button onClick={() => resetGame(game.id)} variant="outline" size="sm" className="text-amber-400 border-amber-400/30 hover:bg-amber-400/10">
                          <RefreshCw className="w-3.5 h-3.5" /> Reset
                        </Button>
                        <Button onClick={() => deleteGame(game.id)} variant="outline" size="sm" className="text-red-400 border-red-400/30 hover:bg-red-400/10">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    </div>

                    {/* Rooms list */}
                    <AnimatePresence>
                      {expandedGame === game.id && rooms[game.id] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-white/5"
                        >
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {rooms[game.id].length === 0 ? (
                              <p className="text-sm text-muted-foreground col-span-2">No rooms yet.</p>
                            ) : rooms[game.id].map((room) => (
                              <div key={room.code} className="bg-white/3 rounded-xl border border-white/5 p-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <div className="font-semibold text-sm text-white">{room.name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{room.code} · {room.memberCount} members</div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="font-mono font-black text-primary text-base">{formatScore(room.score)}</span>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => resetRoom(game.id, room.code)}
                                        className="text-xs text-amber-400/70 hover:text-amber-400 px-1.5 py-0.5 rounded border border-amber-400/20 hover:border-amber-400/40 transition"
                                        title="Reset room score"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => deleteRoom(game.id, room.code)}
                                        className="text-xs text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-400/20 hover:border-red-400/40 transition"
                                        title="Remove room"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                {/* Members */}
                                <div className="flex flex-wrap gap-1">
                                  {room.members.map((m) => (
                                    <div key={m.id} className="flex items-center gap-1 text-xs bg-white/5 px-2 py-0.5 rounded-full group">
                                      {m.isLeader && <span className="text-amber-400">★</span>}
                                      <span className="text-white/70">{m.name}</span>
                                      <button
                                        onClick={() => kickMember(m.id, m.name)}
                                        className="text-red-400/40 hover:text-red-400 ml-0.5 opacity-0 group-hover:opacity-100 transition"
                                        title={`Kick ${m.name}`}
                                      >
                                        <UserX className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PLAYERS & NFTS ────────────────────────────────────────────── */}

        {tab === "players" && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="date"
                value={playersDate}
                onChange={(e) => setPlayersDate(e.target.value)}
                className="max-w-[180px]"
              />
              <Button onClick={fetchPlayers} variant="outline" size="sm" disabled={playersLoading}>
                <RefreshCw className={cn("w-3.5 h-3.5", playersLoading && "animate-spin")} />
                Load
              </Button>

              {/* NFT mint button */}
              <div className="ml-auto flex items-center gap-2">
                {nmkrConfigured && (
                  <span className={cn(
                    "text-xs font-mono px-2 py-0.5 rounded-full border",
                    nmkrNetwork === "mainnet"
                      ? "border-green-500/40 text-green-400 bg-green-500/10"
                      : "border-amber-400/40 text-amber-400 bg-amber-400/10"
                  )}>
                    {nmkrNetwork === "mainnet" ? "● mainnet" : "● preprod (testnet)"}
                  </span>
                )}
              {!nmkrConfigured && (
                  <span className="text-xs text-amber-400/70 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> NMKR not configured
                  </span>
                )}
                <Button
                  onClick={() => mintNfts(true)}
                  disabled={minting || !nmkrConfigured}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {minting
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Minting...</>
                    : <><Send className="w-3.5 h-3.5" /> Send NFTs to pending</>
                  }
                </Button>
              </div>
            </div>

            {/* NMKR setup hint */}
            {!nmkrConfigured && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 text-sm text-purple-300">
                <ImageIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold mb-1">Set up NMKR to send participation NFTs</div>
                  <ol className="text-xs text-purple-300/70 space-y-1 list-decimal list-inside">
                    <li>Create an account at <strong>studio.nmkr.io</strong></li>
                    <li>Create a project → upload your participation badge image + metadata</li>
                    <li>Copy your API key and Project UID</li>
                    <li>Add <code className="bg-white/10 px-1 rounded">NMKR_API_KEY</code> and <code className="bg-white/10 px-1 rounded">NMKR_PROJECT_UID</code> to your Render env vars</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Summary */}
            {players.length > 0 && (
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">{players.length} total players</span>
                <span className="text-green-400">{players.filter((p) => p.fields["NFT Sent"]).length} NFT sent</span>
                <span className="text-amber-400">
                  {players.filter((p) => !p.fields["NFT Sent"] && p.fields["Wallet Address"]).length} pending
                </span>
                <span className="text-red-400/60">
                  {players.filter((p) => !p.fields["Wallet Address"]).length} no wallet
                </span>
              </div>
            )}

            {/* Players list */}
            {playersLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Loading players...</div>
            ) : players.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No players found for this date.</p>
                <p className="text-xs mt-1">Players are saved automatically when a game finishes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((p) => {
                  const s = nftStatuses[p.id];
                  const hasWallet = !!p.fields["Wallet Address"];
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      className="flex items-center gap-3 rounded-xl border border-white/5 px-4 py-3 bg-white/2"
                    >
                      {/* NFT status icon */}
                      <div className="w-6 shrink-0">
                        {s?.state === "done" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                        {s?.state === "minting" && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                        {s?.state === "error" && <span title={s.error}><XCircle className="w-5 h-5 text-red-400" /></span>}
                        {s?.state === "pending" && hasWallet && <div className="w-5 h-5 rounded-full border-2 border-amber-400/40" />}
                        {!hasWallet && <div className="w-5 h-5 rounded-full border-2 border-white/10" />}
                      </div>

                      {/* Player info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{p.fields["Name"]}</span>
                          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                            {p.fields["Team"]}
                          </span>
                          {p.fields["Team Rank"] <= 3 && (
                            <span className="text-xs">
                              {p.fields["Team Rank"] === 1 ? "🥇" : p.fields["Team Rank"] === 2 ? "🥈" : "🥉"}
                            </span>
                          )}
                        </div>
                        {hasWallet ? (
                          <div className="text-xs text-green-400/70 font-mono mt-0.5">
                            {shortenAddress(p.fields["Wallet Address"], 12, 8)}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-0.5">No wallet connected</div>
                        )}
                        {s?.txHash && s.txHash !== "pending" && (
                          <div className="text-xs text-primary/60 font-mono mt-0.5">tx: {shortenAddress(s.txHash, 10, 8)}</div>
                        )}
                      </div>

                      {/* Score */}
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm text-primary">{formatScore(p.fields["Team Score"])}</div>
                        <div className="text-xs text-muted-foreground">pts</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AIRTABLE HISTORY ──────────────────────────────────────────── */}

        {tab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="max-w-[180px]"
              />
              <Button onClick={fetchHistory} variant="outline" size="sm" disabled={historyLoading}>
                <RefreshCw className={cn("w-3.5 h-3.5", historyLoading && "animate-spin")} />
                Load
              </Button>
              <Button onClick={() => { setHistoryDate(""); fetchHistory(); }} variant="ghost" size="sm">
                All time
              </Button>
            </div>

            {!import.meta.env.VITE_AIRTABLE_API_KEY && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 text-sm text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Airtable not configured. Add <code className="font-mono text-xs bg-white/10 px-1 rounded">VITE_AIRTABLE_API_KEY</code> and{" "}
                <code className="font-mono text-xs bg-white/10 px-1 rounded">VITE_AIRTABLE_BASE_ID</code> to your <code>.env</code>.
              </div>
            )}

            {historyLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Loading from Airtable...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No results found{historyDate ? ` for ${historyDate}` : ""}.</p>
                <p className="text-xs mt-1">Results are saved automatically when a game finishes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 rounded-xl border border-white/5 px-4 py-3 bg-white/2">
                    <div className={cn(
                      "text-xl w-8 text-center",
                      r.fields["Rank"] === 1 ? "text-amber-400" : r.fields["Rank"] === 2 ? "text-slate-300" : r.fields["Rank"] === 3 ? "text-amber-700" : "text-white/30"
                    )}>
                      {r.fields["Rank"] === 1 ? "🥇" : r.fields["Rank"] === 2 ? "🥈" : r.fields["Rank"] === 3 ? "🥉" : `#${r.fields["Rank"]}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-white">{r.fields["Team Name"]}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="text-primary/60 font-mono mr-2">{r.fields["Game Code"]}</span>
                        {r.fields["Members"]}
                      </div>
                      {r.fields["Wallet Addresses"] && (
                        <div className="text-xs text-green-400/60 font-mono mt-0.5 truncate">{r.fields["Wallet Addresses"]}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-black font-mono text-primary">{formatScore(r.fields["Score"])}</div>
                      <div className="text-xs text-muted-foreground">{r.fields["Event Date"]}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
