import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Monitor, ArrowLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gameSocket } from "@/lib/websocket";
import { toast } from "sonner";
import { saveGameSession } from "@/lib/airtable";

const HOST_SESSION_KEY = "cq_host_session";

export default function Host() {
  const [, nav] = useLocation();
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const off = gameSocket.on((msg) => {
      if (msg.type === "GAME_CREATED") {
        setGameCode(msg.game.code);
        setGameId(msg.game.id);
        setCreating(false);
        // Save session and Airtable record
        localStorage.setItem(HOST_SESSION_KEY, JSON.stringify({ gameCode: msg.game.code, gameId: msg.game.id }));
        saveGameSession(msg.game.code);
      }
      if (msg.type === "ERROR") {
        toast.error(msg.message);
        setCreating(false);
      }
    });
    return off;
  }, []);

  function createGame() {
    setCreating(true);
    gameSocket.send({ type: "CREATE_GAME" });
  }

  function copy() {
    if (!gameCode) return;
    navigator.clipboard.writeText(gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <button onClick={() => nav("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0033AD]/20 border border-[#0033AD]/30 mb-2">
            <Monitor className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black">Host Dashboard</h1>
          <p className="text-sm text-muted-foreground">Create a game session for the meetup</p>
        </div>

        {!gameCode ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass rounded-2xl p-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              You'll get a <strong className="text-white">game code</strong> to share with group leaders. Leaders create rooms and groups join via QR code.
            </p>
            <Button onClick={createGame} disabled={creating} size="lg" className="w-full">
              {creating ? "Creating..." : "Create Game Session"}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="card-glass rounded-2xl p-6 text-center space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-widest">Game Code — share with leaders</div>
              <div className="font-mono text-6xl font-black tracking-widest text-primary text-glow">
                {gameCode}
              </div>
              <button onClick={copy} className="flex items-center gap-2 mx-auto text-xs text-muted-foreground hover:text-primary">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy code"}
              </button>
            </div>

            <div className="card-glass rounded-2xl p-4 text-sm text-muted-foreground space-y-2">
              <div className="font-semibold text-white text-xs uppercase tracking-wider mb-3">How it works</div>
              <div className="flex gap-3"><span className="text-primary font-bold">1.</span><span>Share game code <strong className="text-white">{gameCode}</strong> with group leaders</span></div>
              <div className="flex gap-3"><span className="text-primary font-bold">2.</span><span>Each leader creates a room — members scan QR to join</span></div>
              <div className="flex gap-3"><span className="text-primary font-bold">3.</span><span>Go to your dashboard to see all rooms and start the game</span></div>
            </div>

            <Button onClick={() => nav(`/host/${gameId}`)} size="lg" className="w-full">
              Open Host Dashboard →
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
