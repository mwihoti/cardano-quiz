import QRCode from "react-qr-code";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { getRoomJoinUrl } from "@/lib/utils";

interface QRCodeDisplayProps {
  roomCode: string;
  roomName: string;
}

export function QRCodeDisplay({ roomCode, roomName }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const url = getRoomJoinUrl(roomCode);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR Code */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-[#0033AD]/20 blur-xl" />
        <div className="relative bg-white p-4 rounded-2xl shadow-2xl">
          <QRCode value={url} size={180} bgColor="#ffffff" fgColor="#0033AD" />
        </div>
      </div>

      {/* Room code badge */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Room Code</div>
        <div className="font-mono text-4xl font-black tracking-widest text-primary">
          {roomCode}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{roomName}</div>
      </div>

      {/* Copy link */}
      <button
        onClick={copy}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-primary/30"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy join link"}
      </button>
    </div>
  );
}
