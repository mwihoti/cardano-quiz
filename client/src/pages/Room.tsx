import { useState, useEffect, useRef } from "react";
import { useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Crown, CheckCircle2, XCircle, Lock, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletConnect } from "@/components/WalletConnect";
import { VoteBar } from "@/components/VoteBar";
import { CountdownTimer } from "@/components/CountdownTimer";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { gameSocket } from "@/lib/websocket";
import { toast } from "sonner";
import { cn, formatScore } from "@/lib/utils";
import type { Member, Question, GameStatus, LeaderboardEntry, Room } from "@/types";

type Phase = "join" | "lobby" | "question" | "result" | "finished";

interface VoteState {
  voteCounts: Record<string, number>;
  totalVotes: number;
  totalMembers: number;
}

interface AnswerResult {
  answer: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  points: number;
  totalScore: number;
}

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const search = useSearch();
  const isLeaderParam = new URLSearchParams(search).get("leader") === "1";
  const isJoinPage = roomCode === "join";

  // Join form state
  const [joinCode, setJoinCode] = useState(isJoinPage ? "" : (roomCode || ""));
  const [myName, setMyName] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Room state
  const [room, setRoom] = useState<Room | null>(null);
  const [isLeader, setIsLeader] = useState(isLeaderParam);
  const [phase, setPhase] = useState<Phase>(isJoinPage ? "join" : "join");
  const [gameStatus, setGameStatus] = useState<GameStatus>("lobby");

  // Question state
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState(0);
  const [voteState, setVoteState] = useState<VoteState>({ voteCounts: { A: 0, B: 0, C: 0, D: 0 }, totalVotes: 0, totalMembers: 0 });
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const socketId = useRef<string | null>(null);

  // If coming from leader page, skip join form
  useEffect(() => {
    if (!isJoinPage && !isLeaderParam) {
      // Pre-fill code, still need name
    }
    if (isLeaderParam && roomCode && roomCode !== "join") {
      // Leader already created room, need to join as leader
      // We'll prompt for name if not set
    }
  }, []);

  useEffect(() => {
    const off = gameSocket.on((msg) => {
      switch (msg.type) {
        case "CONNECTED":
          socketId.current = msg.socketId;
          break;

        case "JOINED_ROOM":
          setRoom(msg.room);
          setGameStatus(msg.gameStatus);
          setTotalQuestions(msg.totalQuestions);
          setPhase(msg.gameStatus === "question" ? "question" : "lobby");
          setJoining(false);
          // Check if I'm the leader
          const me = msg.room.members.find((m: Member) => m.id === gameSocket.socketId);
          if (me?.isLeader) setIsLeader(true);
          if (msg.currentQuestion) {
            setQuestion(msg.currentQuestion);
            setQuestionIndex(msg.currentQuestionIndex);
          }
          break;

        case "MEMBER_JOINED":
          setRoom((r) => r ? { ...r, members: msg.members } : r);
          toast(`${msg.member.name} joined the room`);
          break;

        case "MEMBER_LEFT":
          setRoom((r) => r ? { ...r, members: msg.members } : r);
          break;

        case "GAME_STARTED":
          setGameStatus("active");
          setTotalQuestions(msg.totalQuestions);
          toast.info("Game starting!");
          break;

        case "QUESTION_STARTED":
          setQuestion(msg.question);
          setQuestionIndex(msg.questionIndex);
          setTotalQuestions(msg.totalQuestions);
          setTimeLimit(msg.timeLimit);
          setSelectedVote(null);
          setResult(null);
          setVoteState({ voteCounts: { A: 0, B: 0, C: 0, D: 0 }, totalVotes: 0, totalMembers: room?.members.length ?? 0 });
          setPhase("question");
          setGameStatus("question");
          break;

        case "VOTE_UPDATE":
          setVoteState({ voteCounts: msg.voteCounts, totalVotes: msg.totalVotes, totalMembers: msg.totalMembers });
          break;

        case "ANSWER_LOCKED":
          setResult({
            answer: msg.answer,
            correct: msg.correct,
            correctAnswer: msg.correctAnswer,
            explanation: msg.explanation,
            points: msg.points,
            totalScore: msg.totalScore,
          });
          setTotalScore(msg.totalScore);
          setPhase("result");
          break;

        case "GAME_FINISHED":
          setLeaderboard(msg.leaderboard);
          setPhase("finished");
          break;

        case "ERROR":
          toast.error(msg.message);
          setJoining(false);
          break;

        case "GAME_RESET":
          toast.info(msg.message);
          setPhase("lobby");
          setQuestion(null);
          setSelectedVote(null);
          setResult(null);
          setTotalScore(0);
          setVoteState({ voteCounts: { A: 0, B: 0, C: 0, D: 0 }, totalVotes: 0, totalMembers: 0 });
          break;

        case "ROOM_RESET":
          toast.info(msg.message);
          setTotalScore(0);
          break;

        case "GAME_DELETED":
        case "KICKED":
          toast.error(msg.message);
          setTimeout(() => { window.location.href = "/"; }, 2500);
          break;
      }
    });
    return off;
  }, [room?.members.length]);

  function join() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { toast.error("Enter a room code"); return; }
    if (!myName.trim()) { toast.error("Enter your name"); return; }
    setJoining(true);
    gameSocket.send({
      type: "JOIN_ROOM",
      roomCode: code,
      name: myName.trim(),
      walletAddress: wallet ?? undefined,
    });
  }

  function vote(opt: string) {
    if (selectedVote || result || !question) return;
    setSelectedVote(opt);
    gameSocket.send({
      type: "VOTE",
      roomCode: room!.code,
      questionIndex,
      vote: opt,
    });
    toast(`Voted ${opt}!`);
  }

  function lockAnswer(opt: string) {
    if (!isLeader || !question) return;
    gameSocket.send({
      type: "LOCK_ANSWER",
      roomCode: room!.code,
      questionIndex,
      answer: opt,
    });
  }

  // ── JOIN FORM ─────────────────────────────────────────────────────────────

  if (phase === "join") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-2">
              <Users className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-black">Join a Room</h1>
            <p className="text-sm text-muted-foreground">Enter your team's room code</p>
          </div>

          <div className="card-glass rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Room Code</label>
              <Input
                placeholder="e.g. AB3X"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="font-mono text-2xl tracking-widest text-center uppercase h-14"
                maxLength={6}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Your Name</label>
              <Input
                placeholder="Your name"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && join()}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                Wallet <span className="text-primary/60">(optional, for ADA rewards)</span>
              </label>
              <WalletConnect onConnected={setWallet} connected={wallet} />
            </div>

            <Button onClick={join} disabled={joining} size="lg" className="w-full">
              {joining ? "Joining..." : "Join Room"}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────

  if (phase === "lobby") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Room</div>
            <h1 className="text-2xl font-black text-white">{room?.name}</h1>
            {isLeader && (
              <div className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
                <Crown className="w-3 h-3" /> Group Leader
              </div>
            )}
          </div>

          {isLeader && room && (
            <div className="flex justify-center">
              <QRCodeDisplay roomCode={room.code} roomName={room.name} />
            </div>
          )}

          {/* Members list */}
          <div className="card-glass rounded-2xl p-4 space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Team Members ({room?.members.length ?? 0})
            </div>
            {room?.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-1">
                {m.isLeader && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {!m.isLeader && <div className="w-3.5 h-3.5 shrink-0" />}
                <span className={cn("text-sm", m.id === gameSocket.socketId ? "text-primary font-bold" : "text-white")}>{m.name}</span>
                {m.walletAddress && (
                  <span className="ml-auto text-xs text-green-400/60 font-mono">💳</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
            Waiting for host to start the game...
          </div>
        </motion.div>
      </div>
    );
  }

  // ── QUESTION ──────────────────────────────────────────────────────────────

  if (phase === "question" && question) {
    return (
      <div className="min-h-dvh flex flex-col p-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-3 mb-4">
          <div>
            <div className="text-xs text-muted-foreground">{room?.name}</div>
            <div className="text-sm font-bold text-white">Q{questionIndex + 1}/{totalQuestions}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="text-xl font-black font-mono text-primary">{formatScore(totalScore)}</div>
            </div>
            <CountdownTimer seconds={timeLimit} />
          </div>
        </div>

        {/* Category & question */}
        <div className="mb-5">
          <span className="text-xs text-primary/70 bg-primary/10 px-2 py-1 rounded-full">{question.category}</span>
          <div className="text-xs text-amber-400 mt-2 mb-1">{question.points} points</div>
          <h2 className="text-lg font-bold text-white leading-snug">{question.question}</h2>
        </div>

        {/* Answer options */}
        <div className="grid grid-cols-1 gap-2 mb-6">
          {(["A", "B", "C", "D"] as const).map((opt) => (
            <motion.button
              key={opt}
              onClick={() => vote(opt)}
              disabled={!!selectedVote}
              whileHover={!selectedVote ? { scale: 1.01 } : {}}
              whileTap={!selectedVote ? { scale: 0.98 } : {}}
              className={cn(
                "answer-btn",
                selectedVote === opt && "selected",
                selectedVote && selectedVote !== opt && "opacity-40"
              )}
            >
              <span className="font-mono font-bold text-white/40 mr-3">{opt}.</span>
              {question.options[opt]}
            </motion.button>
          ))}
        </div>

        {/* Vote distribution */}
        <div className="card-glass rounded-xl p-4 mb-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Team Votes ({voteState.totalVotes}/{voteState.totalMembers})
          </div>
          <VoteBar
            voteCounts={voteState.voteCounts}
            totalMembers={voteState.totalMembers}
            myVote={selectedVote ?? undefined}
          />
        </div>

        {/* Leader lock button */}
        {isLeader && selectedVote && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Button
              onClick={() => lockAnswer(selectedVote)}
              size="xl"
              className="w-full bg-amber-500 hover:bg-amber-400 text-black"
            >
              <Lock className="w-5 h-5" />
              Lock Answer: {selectedVote}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Discuss with your team, then lock your group's final answer
            </p>
          </motion.div>
        )}

        {isLeader && !selectedVote && (
          <div className="text-center text-xs text-amber-400/70 mt-2">
            Vote first, then you can lock the group's answer
          </div>
        )}

        {!isLeader && selectedVote && (
          <div className="text-center text-xs text-muted-foreground mt-2 animate-pulse">
            Waiting for leader to lock the answer...
          </div>
        )}
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────

  if (phase === "result" && result) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full space-y-6 text-center"
        >
          {/* Correct / Wrong indicator */}
          <div className="flex flex-col items-center gap-3">
            {result.correct ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-green-400" />
                </motion.div>
                <div className="text-3xl font-black text-green-300">+{result.points} pts!</div>
              </>
            ) : (
              <>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                  <XCircle className="w-20 h-20 text-red-400" />
                </motion.div>
                <div className="text-2xl font-black text-red-300">Not quite!</div>
              </>
            )}
            <div className="text-sm text-muted-foreground">
              {result.correct ? "Your team locked the right answer!" : `Correct answer was ${result.correctAnswer}`}
            </div>
          </div>

          {/* Explanation */}
          <div className="card-glass rounded-xl p-4 text-left">
            <div className="text-xs text-primary/70 uppercase tracking-wider mb-2">Explanation</div>
            <p className="text-sm text-white/80 leading-relaxed">{result.explanation}</p>
          </div>

          {/* Vote breakdown */}
          <div className="card-glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">How your team voted</div>
            <VoteBar
              voteCounts={voteState.voteCounts}
              totalMembers={voteState.totalMembers}
              lockedAnswer={result.answer}
              correctAnswer={result.correctAnswer}
              myVote={selectedVote ?? undefined}
              showLabels={false}
            />
          </div>

          {/* Score */}
          <div className="card-glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Team Total</div>
            <div className="text-4xl font-black font-mono text-primary">{formatScore(result.totalScore)}</div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
            Waiting for next question...
          </div>
        </motion.div>
      </div>
    );
  }

  // ── FINISHED ──────────────────────────────────────────────────────────────

  if (phase === "finished") {
    const myRoom = room;
    const myEntry = leaderboard.find((e) => e.code === myRoom?.code);

    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-3xl font-black text-white">Game Over!</h1>
            {myEntry && (
              <p className="text-muted-foreground">
                {myRoom?.name} finished <strong className="text-primary">#{myEntry.rank}</strong> with{" "}
                <strong className="text-white">{formatScore(myEntry.score)}</strong> pts
              </p>
            )}
          </div>

          {/* Leaderboard */}
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.code}
                className={cn(
                  "flex items-center gap-4 rounded-xl border px-4 py-3",
                  entry.code === myRoom?.code ? "border-primary/40 bg-primary/10" : "border-white/5 bg-white/2",
                  entry.rank === 1 ? "border-amber-400/40 bg-amber-400/5" : ""
                )}
              >
                <div className="text-xl w-8 text-center">
                  {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">{entry.name}</div>
                  <div className="text-xs text-muted-foreground">{entry.members?.length ?? 0} members</div>
                </div>
                <div className="font-black font-mono text-primary">{formatScore(entry.score)}</div>
              </div>
            ))}
          </div>

          {myEntry && myEntry.rank <= 3 && (
            <div className="card-glass rounded-xl p-4 text-center">
              <div className="text-amber-400 font-bold text-sm mb-1">
                {myEntry.rank === 1 ? "You won! 🏆" : "Top 3 finish!"}
              </div>
              <p className="text-xs text-muted-foreground">
                If your team connected Cardano wallets, the host can send ADA rewards!
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return null;
}
