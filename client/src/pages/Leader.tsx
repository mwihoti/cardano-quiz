import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Crown, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletConnect } from "@/components/WalletConnect";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { gameSocket } from "@/lib/websocket";
import { toast } from "sonner";

export default function Leader() {
  const [, nav] = useLocation();
  const [gameCode, setGameCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const off = gameSocket.on((msg) => {
      if (msg.type === "ROOM_CREATED") {
        setRoomCode(msg.room.code);
        setGameId(msg.gameId);
        setCreating(false);
        toast.success(`Room "${msg.room.name}" created!`);
      }
      if (msg.type === "ERROR") {
        toast.error(msg.message);
        setCreating(false);
      }
    });
    return off;
  }, []);

  // After room is created, navigate to room page as leader
  useEffect(() => {
    if (roomCode && gameId) {
      // Small delay to show QR code first
    }
  }, [roomCode, gameId]);

  function create() {
    if (!gameCode.trim()) { toast.error("Enter the game code from the host"); return; }
    if (!leaderName.trim()) { toast.error("Enter your name"); return; }
    setCreating(true);
    gameSocket.send({
      type: "CREATE_ROOM",
      gameCode: gameCode.toUpperCase(),
      roomName: roomName || `${leaderName}'s Team`,
      leaderName: leaderName.trim(),
      walletAddress: wallet ?? undefined,
    });
  }

  if (roomCode) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Room created!</div>
            <h1 className="text-xl font-black text-white">Show this to your team</h1>
          </div>

          <QRCodeDisplay roomCode={roomCode} roomName={roomName || `${leaderName}'s Team`} />

          <Button
            onClick={() => nav(`/room/${roomCode}?leader=1`)}
            size="lg"
            className="w-full"
          >
            Enter Room as Leader →
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Your team scans the QR code or visits the join link
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <button onClick={() => nav("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 mb-2">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-black">Create Your Room</h1>
          <p className="text-sm text-muted-foreground">You'll get a QR code for your team to scan</p>
        </div>

        <div className="card-glass rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Game Code (from host)</label>
            <Input
              placeholder="e.g. AB3X7K"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              className="font-mono text-lg tracking-widest text-center uppercase"
              maxLength={8}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Your Name</label>
            <Input
              placeholder="Leader's name"
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Team Name (optional)</label>
            <Input
              placeholder={leaderName ? `${leaderName}'s Team` : "e.g. Cardano Lions"}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Cardano Wallet <span className="text-primary/60">(for ADA rewards)</span>
            </label>
            <WalletConnect onConnected={setWallet} connected={wallet} />
          </div>

          <Button onClick={create} disabled={creating} size="lg" className="w-full">
            {creating ? "Creating Room..." : "Create Room & Get QR Code"}
          </Button>
        </div>
      </div>
    </div>
  );
}
