import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Monitor, Crown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [, nav] = useLocation();

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
        className="relative z-10 w-full max-w-md space-y-8"
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
