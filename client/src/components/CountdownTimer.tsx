import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  seconds: number;
  onExpire?: () => void;
  className?: string;
}

export function CountdownTimer({ seconds, onExpire, className }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpire]);

  const pct = (remaining / seconds) * 100;
  const isLow = remaining <= 10;
  const isCritical = remaining <= 5;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn(
        "text-5xl font-mono font-black tabular-nums transition-colors",
        isCritical ? "text-red-400" : isLow ? "text-amber-400" : "text-primary"
      )}>
        {remaining}
      </div>

      {/* Ring progress */}
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <motion.circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke={isCritical ? "#f87171" : isLow ? "#fbbf24" : "#0033AD"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 24}`}
            strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
            transition={{ duration: 0.5 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xs font-bold", isCritical ? "text-red-400" : "text-primary")}>
            {remaining}s
          </span>
        </div>
      </div>
    </div>
  );
}
