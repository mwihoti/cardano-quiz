import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Monitor, Crown, Users, RefreshCw } from "lucide-react";

const HOST_SESSION_KEY = "cq_host_session";
const ROOM_SESSION_KEY = "cq_room_session";

interface HostSession { gameCode: string; gameId: string; }
interface RoomSession { roomCode: string; name: string; isLeader: boolean; gameCode: string; }

export default function Home() {
  const [, nav] = useLocation();
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [roomSession, setRoomSession] = useState<RoomSession | null>(null);

  useEffect(() => {
    try {
      const h = localStorage.getItem(HOST_SESSION_KEY);
      if (h) setHostSession(JSON.parse(h));
      const r = localStorage.getItem(ROOM_SESSION_KEY);
      if (r) setRoomSession(JSON.parse(r));
    } catch { /* ignore */ }
  }, []);

  function clearSessions() {
    localStorage.removeItem(HOST_SESSION_KEY);
    localStorage.removeItem(ROOM_SESSION_KEY);
    setHostSession(null);
    setRoomSession(null);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#0033AD]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#0033AD]/8 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md space-y-6"
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0033AD]/20 border border-[#0033AD]/30 mb-4">
            <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none">
              <circle cx="24" cy="24" r="20" fill="#0033AD" opacity="0.15" />
              <path d="M24 8 L36 20 L36 32 L24 40 L12 32 L12 20 Z" stroke="#4d7fff" strokeWidth="2" fill="none" />
              <circle cx="24" cy="24" r="4" fill="#4d7fff" />
              <circle cx="24" cy="14" r="2" fill="#0033AD" />
              <circle cx="24" cy="34" r="2" fill="#0033AD" />
              <circle cx="15" cy="19" r="2" fill="#0033AD" />
              <circle cx="33" cy="19" r="2" fill="#0033AD" />
              <circle cx="15" cy="29" r="2" fill="#0033AD" />
              <circle cx="33" cy="29" r="2" fill="#0033AD" />
            </svg>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Cardano<span className="text-primary text-glow"> Quiz</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Nairobi Cardano Meetup · Group Challenge
          </p>
        </div>

        {/* Resume sessions */}
        {(hostSession || roomSession) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass rounded-2xl p-4 border border-primary/20 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-primary/70 uppercase tracking-wider font-semibold">Resume session</div>
              <button onClick={clearSessions} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            </div>

            {hostSession && (
              <button
                onClick={() => nav(`/host/${hostSession.gameId}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 hover:border-primary/40 transition-all text-left"
              >
                <Monitor className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">Resume hosting</div>
                  <div className="text-xs text-muted-foreground">Game code: <span className="font-mono text-primary">{hostSession.gameCode}</span></div>
                </div>
                <RefreshCw className="w-4 h-4 text-primary/60 ml-auto shrink-0" />
              </button>
            )}

            {roomSession && (
              <button
                onClick={() => nav(`/room/${roomSession.roomCode}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-400/10 border border-amber-400/20 hover:border-amber-400/40 transition-all text-left"
              >
                {roomSession.isLeader
                  ? <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                  : <Users className="w-5 h-5 text-green-400 shrink-0" />}
                <div>
                  <div className="text-sm font-bold text-white">
                    {roomSession.isLeader ? "Resume as leader" : "Rejoin room"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {roomSession.name} · Room <span className="font-mono text-amber-400">{roomSession.roomCode}</span>
                  </div>
                </div>
                <RefreshCw className="w-4 h-4 text-amber-400/60 ml-auto shrink-0" />
              </button>
            )}
          </motion.div>
        )}

        {/* Role selector */}
        <div className="space-y-3">
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <button
              onClick={() => nav("/host")}
              className="w-full card-glass rounded-2xl p-5 text-left hover:border-primary/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0033AD]/20 flex items-center justify-center group-hover:bg-[#0033AD]/30 transition-colors">
                  <Monitor className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-white">I'm the Host</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Create & control the game session</div>
                </div>
              </div>
            </button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <button
              onClick={() => nav("/leader")}
              className="w-full card-glass rounded-2xl p-5 text-left hover:border-amber-400/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                  <Crown className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="font-bold text-white">I'm a Group Leader</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Create a room & invite your team</div>
                </div>
              </div>
            </button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <button
              onClick={() => nav("/room/join")}
              className="w-full card-glass rounded-2xl p-5 text-left hover:border-green-400/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <Users className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="font-bold text-white">I'm joining a group</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Enter a room code to join your team</div>
                </div>
              </div>
            </button>
          </motion.div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Cardano · Built for NBO Meetup 2026
        </p>
      </motion.div>
    </div>
  );
}
