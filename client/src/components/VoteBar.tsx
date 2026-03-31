import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const OPTION_COLORS: Record<string, string> = {
  A: "bg-blue-500",
  B: "bg-purple-500",
  C: "bg-amber-500",
  D: "bg-rose-500",
};

const OPTION_TEXT: Record<string, string> = {
  A: "text-blue-300",
  B: "text-purple-300",
  C: "text-amber-300",
  D: "text-rose-300",
};

interface VoteBarProps {
  voteCounts: Record<string, number>;
  totalMembers: number;
  lockedAnswer?: string;
  correctAnswer?: string;
  myVote?: string;
  showLabels?: boolean;
}

export function VoteBar({ voteCounts, totalMembers, lockedAnswer, correctAnswer, myVote, showLabels = true }: VoteBarProps) {
  const total = Object.values(voteCounts).reduce((s, v) => s + v, 0);
  const options = ["A", "B", "C", "D"];

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const count = voteCounts[opt] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        const isLocked = lockedAnswer === opt;
        const isCorrect = correctAnswer === opt;
        const isWrong = lockedAnswer !== undefined && lockedAnswer === opt && !isCorrect;
        const isMyVote = myVote === opt;

        return (
          <div key={opt} className="flex items-center gap-3">
            {/* Option letter */}
            <span className={cn("font-mono font-bold text-sm w-5 shrink-0", OPTION_TEXT[opt])}>
              {opt}
            </span>

            {/* Bar container */}
            <div className="flex-1 relative h-8 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  isCorrect ? "bg-green-500" : isWrong ? "bg-red-500" : OPTION_COLORS[opt],
                  "opacity-70"
                )}
              />
              <div className="absolute inset-0 flex items-center px-3">
                <span className="text-xs text-white/70 font-medium">
                  {count} vote{count !== 1 ? "s" : ""}{pct > 0 ? ` (${Math.round(pct)}%)` : ""}
                </span>
              </div>
            </div>

            {/* Indicators */}
            <div className="flex gap-1 w-12 shrink-0 justify-end">
              {isCorrect && correctAnswer && (
                <span className="text-xs text-green-400 font-bold">✓</span>
              )}
              {isWrong && <span className="text-xs text-red-400 font-bold">✗</span>}
              {isMyVote && !correctAnswer && (
                <span className="text-xs text-primary font-bold">you</span>
              )}
              {isLocked && !correctAnswer && (
                <span className="text-xs text-amber-400 font-bold">🔒</span>
              )}
            </div>
          </div>
        );
      })}

      {showLabels && (
        <div className="text-xs text-muted-foreground text-right mt-1">
          {total} of {totalMembers} voted
        </div>
      )}
    </div>
  );
}
