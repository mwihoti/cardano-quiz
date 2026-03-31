import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ChevronRight, Trophy, Users, StopCircle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/RoomCard";
import { gameSocket } from "@/lib/websocket";
import { toast } from "sonner";
import type { RoomSummary, Question, LeaderboardEntry, GameStatus } from "@/types";
import { formatScore, shortenAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { saveGameResults, updatePlayerScores, saveEvent } from "@/lib/airtable";

type Tab = "rooms" | "leaderboard";

export default function HostDashboard() {
  const { gameId } = useParams<{ gameId: string }>();
  const [status, setStatus] = useState<GameStatus>("lobby");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameCode, setGameCode] = useState("");
  const [tab, setTab] = useState<Tab>("rooms");

  // Fetch initial state
  useEffect(() => {
    gameSocket.send({ type: "GET_STATE", gameId });
  }, [gameId]);

  useEffect(() => {
    const off = gameSocket.on((msg) => {
      switch (msg.type) {
        case "HOST_STATE":
          setStatus(msg.game.status);
          setGameCode(msg.game.code);
          setRooms(msg.rooms);
          setCurrentIndex(msg.currentQuestionIndex);
          setTotalQuestions(msg.totalQuestions);
          break;
        case "ROOMS_UPDATE":
          setRooms(msg.rooms);
          break;
        case "GAME_STARTED":
          setStatus("active");
          setTotalQuestions(msg.totalQuestions);
          toast.success("Game started!");
          break;
        case "QUESTION_STARTED":
          setCurrentQuestion(msg.question);
          setCurrentIndex(msg.questionIndex);
          setTotalQuestions(msg.totalQuestions);
          setTimeLeft(msg.timeLimit);
          setStatus("question");
          break;
        case "GAME_FINISHED":
          setLeaderboard(msg.leaderboard);
          setStatus("finished");
          setCurrentQuestion(null);
          setTab("leaderboard");
          localStorage.removeItem("cq_host_session");
          // Auto-save everything to Airtable
          {
            const lb = msg.leaderboard.map((e: LeaderboardEntry) => ({
              rank: e.rank, name: e.name, score: e.score, members: e.members ?? [],
            }));
            const totalPlayers = lb.reduce((s: number, e: typeof lb[0]) => s + e.members.length, 0);
            Promise.all([
              saveGameResults(gameCode, lb, totalQuestions),
              updatePlayerScores(gameCode, lb),
              saveEvent(gameCode, lb.length, totalPlayers, lb[0]?.name ?? ""),
            ]).then(() => toast.success("Results & players saved to Airtable ✓")).catch(() => {});
          }
          break;
        case "ERROR":
          toast.error(msg.message);
          break;
      }
    });
    return off;
  }, []);

  // Countdown for host display
  useEffect(() => {
    if (status !== "question" || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, status]);

  const startGame = () => gameSocket.send({ type: "START_GAME", gameId });
  const nextQuestion = () => gameSocket.send({ type: "NEXT_QUESTION", gameId });
  const endGame = () => {
    if (confirm("End the game and show final leaderboard?")) {
      gameSocket.send({ type: "END_GAME", gameId });
    }
  };

  const sortedRooms = [...rooms].sort((a, b) => b.score - a.score);
  const lockedCount = rooms.filter((r) => r.lockedAnswer !== undefined).length;
  const totalVotes = rooms.reduce((s, r) => s + Object.values(r.voteCounts).reduce((a, b) => a + b, 0), 0);
  const totalMembers = rooms.reduce((s, r) => s + r.memberCount, 0);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/80 backdrop-blur px-3 sm:px-4 py-2 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="text-sm font-bold text-white shrink-0">Cardano Quiz</div>
            <div className={cn(
              "text-xs px-2 py-0.5 rounded-full font-mono shrink-0",
              status === "lobby" ? "bg-amber-400/15 text-amber-400" :
              status === "question" ? "bg-primary/15 text-primary animate-pulse" :
              status === "finished" ? "bg-green-500/15 text-green-400" :
              "bg-white/10 text-white/60"
            )}>
              {status.toUpperCase()}
            </div>
            {status === "question" && (
              <div className="text-xs text-muted-foreground truncate">
                Q{currentIndex + 1}/{totalQuestions} · {timeLeft}s
              </div>
            )}
            <div className="text-xs text-muted-foreground hidden sm:block shrink-0">
              {rooms.length}r · {totalMembers}p
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {status === "lobby" && (
              <Button onClick={startGame} disabled={rooms.length === 0} size="sm">
                <Play className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Start Game</span>
              </Button>
            )}
            {status === "active" && (
              <Button onClick={nextQuestion} size="sm">
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">First Question</span>
              </Button>
            )}
            {status === "question" && (
              <Button onClick={nextQuestion} size="sm" variant={lockedCount === rooms.length ? "default" : "outline"}>
                <ChevronRight className="w-3.5 h-3.5" />
                {lockedCount === rooms.length
                  ? <span>Next →</span>
                  : <span className="hidden sm:inline">Next ({lockedCount}/{rooms.length})</span>}
                {lockedCount !== rooms.length && <span className="sm:hidden">Next</span>}
              </Button>
            )}
            {(status === "question" || status === "active") && (
              <Button onClick={endGame} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 px-2">
                <StopCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Current question banner */}
      <AnimatePresence>
        {currentQuestion && status === "question" && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-b border-primary/20 bg-primary/5 px-4 py-4"
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-primary/70 font-mono">Q{currentIndex + 1}</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-white/5">{currentQuestion.category}</span>
                    <span className="text-xs text-amber-400">{currentQuestion.points} pts</span>
                  </div>
                  <p className="text-white font-semibold leading-snug max-w-3xl">{currentQuestion.question}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {(["A", "B", "C", "D"] as const).map((opt) => (
                      <div key={opt} className="flex items-start gap-2 text-xs text-muted-foreground bg-white/3 rounded-lg px-2 py-2">
                        <span className="font-mono font-bold text-white/40 shrink-0">{opt}.</span>
                        <span className="break-words">{currentQuestion.options[opt]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn(
                    "text-4xl font-mono font-black",
                    timeLeft <= 5 ? "text-red-400 animate-pulse" : timeLeft <= 10 ? "text-amber-400" : "text-primary"
                  )}>
                    {timeLeft}s
                  </div>
                  <div className="text-xs text-muted-foreground">{totalVotes} votes</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/5">
          {[
            { id: "rooms" as Tab, label: "Live Rooms", icon: BarChart3 },
            { id: "leaderboard" as Tab, label: "Leaderboard", icon: Trophy },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === "rooms" && rooms.length > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{rooms.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Rooms grid */}
        {tab === "rooms" && (
          <>
            {rooms.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Waiting for group leaders to create rooms...</p>
                <p className="text-xs mt-2">Share the game code with leaders so they can set up their groups.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedRooms.map((room, idx) => (
                  <RoomCard
                    key={room.code}
                    room={room}
                    rank={idx + 1}
                    questionActive={status === "question"}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Leaderboard */}
        {tab === "leaderboard" && (
          <div className="max-w-2xl mx-auto space-y-3">
            {status === "finished" && (
              <div className="text-center mb-6 space-y-1">
                <div className="text-4xl">🎉</div>
                <h2 className="text-2xl font-black text-white">Final Results</h2>
                <p className="text-muted-foreground text-sm">Top teams eligible for ADA rewards</p>
              </div>
            )}

            {(leaderboard.length > 0 ? leaderboard : sortedRooms.map((r, i) => ({ rank: i+1, name: r.name, score: r.score, members: r.members as any, code: r.code }))).map((entry) => (
              <motion.div
                key={entry.code}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: entry.rank * 0.05 }}
                className={cn(
                  "flex items-center gap-4 rounded-xl border px-5 py-4 transition-all",
                  entry.rank === 1 ? "border-amber-400/40 bg-amber-400/5" :
                  entry.rank === 2 ? "border-slate-300/30 bg-slate-300/3" :
                  entry.rank === 3 ? "border-amber-700/30 bg-amber-700/3" :
                  "border-white/5 bg-white/2"
                )}
              >
                <div className={cn(
                  "text-2xl font-black w-10 text-center",
                  entry.rank === 1 ? "text-amber-400" :
                  entry.rank === 2 ? "text-slate-300" :
                  entry.rank === 3 ? "text-amber-700" :
                  "text-white/40"
                )}>
                  {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{entry.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.members?.map((m: any) => (
                      <span key={m.id} className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5 flex items-center gap-1">
                        {m.isLeader && <span className="text-amber-400">★</span>}
                        {m.name}
                        {m.walletAddress && (
                          <span className="text-primary/60 font-mono">{shortenAddress(m.walletAddress, 4, 4)}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-2xl font-black font-mono text-primary">{formatScore(entry.score)}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </motion.div>
            ))}

            {status === "finished" && leaderboard.length > 0 && (
              <div className="mt-6 card-glass rounded-xl p-4">
                <div className="text-sm font-bold text-white mb-3">ADA Reward Distribution</div>
                <div className="space-y-2 text-sm">
                  {leaderboard.slice(0, 3).map((entry) => (
                    <div key={entry.code} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}</span>
                        <span className="text-white">{entry.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.members?.filter((m: any) => m.walletAddress).map((m: any) => (
                          <div key={m.id} className="font-mono">{shortenAddress(m.walletAddress!, 8, 6)}</div>
                        ))}
                        {entry.members?.every((m: any) => !m.walletAddress) && (
                          <span className="text-red-400/60">No wallets connected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Use Eternl or Typhon to send ADA to the wallet addresses above.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
