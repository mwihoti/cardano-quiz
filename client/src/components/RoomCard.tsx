import { motion } from "framer-motion";
import { Users, Lock, Clock } from "lucide-react";
import type { RoomSummary } from "@/types";
import { cn, formatScore } from "@/lib/utils";

interface RoomCardProps {
  room: RoomSummary;
  rank?: number;
  questionActive?: boolean;
}

const OPTION_COLORS: Record<string, string> = {
  A: "bg-blue-500",
  B: "bg-purple-500",
  C: "bg-amber-500",
  D: "bg-rose-500",
};

export function RoomCard({ room, rank, questionActive }: RoomCardProps) {
  const totalVotes = Object.values(room.voteCounts).reduce((s, v) => s + v, 0);
  const isLocked = room.lockedAnswer !== undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-xl border p-4 transition-all",
        isLocked
          ? "border-green-500/40 bg-green-500/5"
          : "border-white/10 bg-white/3",
        rank === 1 && "border-amber-400/40 bg-amber-400/5"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {rank && (
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded",
                rank === 1 ? "bg-amber-400 text-black" :
                rank === 2 ? "bg-slate-300 text-black" :
                rank === 3 ? "bg-amber-700 text-white" :
                "bg-white/10 text-white/60"
              )}>
                #{rank}
              </span>
            )}
            <h3 className="font-semibold text-sm text-white">{room.name}</h3>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{room.memberCount} members</span>
            <span className="mx-1">·</span>
            <span className="font-mono text-primary/70">{room.code}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black font-mono text-primary">{formatScore(room.score)}</div>
          <div className="text-xs text-muted-foreground">pts</div>
        </div>
      </div>

      {/* Vote visualization */}
      {questionActive && (
        <div className="space-y-1.5 mt-3">
          {["A", "B", "C", "D"].map((opt) => {
            const count = room.voteCounts[opt] ?? 0;
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            return (
              <div key={opt} className="flex items-center gap-2">
                <span className="text-xs font-mono text-white/40 w-3">{opt}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                    className={cn("h-full rounded-full opacity-80", OPTION_COLORS[opt])}
                  />
                </div>
                <span className="text-xs text-white/40 w-3 tabular-nums">{count}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{totalVotes}/{room.memberCount} voted</span>
            {isLocked && (
              <span className="flex items-center gap-1 text-green-400">
                <Lock className="w-3 h-3" />
                Locked: {room.lockedAnswer}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Members bubbles */}
      <div className="flex flex-wrap gap-1 mt-3">
        {room.members.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
              m.vote ? "bg-primary/20 text-primary" : "bg-white/5 text-white/40"
            )}
            title={m.name}
          >
            {m.isLeader && <span className="text-amber-400">★</span>}
            <span className="truncate max-w-[80px]">{m.name}</span>
            {m.vote && <span className="font-mono text-xs opacity-70">{m.vote}</span>}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
