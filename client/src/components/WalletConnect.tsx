import { useState } from "react";
import { Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detectAndConnectWallet, walletName, shortenAddress } from "@/lib/utils";

interface WalletConnectProps {
  onConnected: (address: string) => void;
  connected?: string | null;
}

export function WalletConnect({ onConnected, connected }: WalletConnectProps) {
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);

  const wName = walletName();

  async function connectBrowser() {
    setLoading(true);
    setError("");
    try {
      const addr = await detectAndConnectWallet();
      if (addr) {
        onConnected(addr);
      } else {
        setError("No Cardano wallet found. Try Eternl or paste your address below.");
        setShowManual(true);
      }
    } catch (e) {
      setError("Wallet connection failed. Paste your address instead.");
      setShowManual(true);
    } finally {
      setLoading(false);
    }
  }

  function submitManual() {
    const addr = manual.trim();
    if (!addr) return;
    if (addr.length < 10) { setError("Invalid address."); return; }
    onConnected(addr);
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-green-300 font-mono text-xs">{shortenAddress(connected)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={connectBrowser}
        disabled={loading}
        variant="outline"
        className="w-full border-[#0033AD]/50 text-[#4d7fff] hover:bg-[#0033AD]/10"
      >
        <Wallet className="w-4 h-4" />
        {loading ? "Connecting..." : wName ? `Connect ${wName}` : "Connect Cardano Wallet"}
      </Button>

      <button
        onClick={() => setShowManual(!showManual)}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 w-full text-center"
      >
        {showManual ? "Hide manual entry" : "No wallet? Paste your ADA address"}
      </button>

      {showManual && (
        <div className="flex gap-2">
          <Input
            placeholder="addr1..."
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="font-mono text-xs"
            onKeyDown={(e) => e.key === "Enter" && submitManual()}
          />
          <Button onClick={submitManual} size="sm" className="shrink-0">Save</Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
