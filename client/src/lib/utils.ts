import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(addr: string, head = 8, tail = 6): string {
  if (!addr || addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

export function formatScore(score: number): string {
  return score.toLocaleString();
}

export function getAppUrl(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function getRoomJoinUrl(roomCode: string): string {
  return `${getAppUrl()}/room/${roomCode}`;
}

/** Detect available Cardano wallets in window.cardano */
export async function detectAndConnectWallet(): Promise<string | null> {
  const w = window as any;
  if (!w.cardano) return null;
  const preferred = ["eternl", "nami", "lace", "flint", "typhon", "gerowallet"];
  for (const name of preferred) {
    if (w.cardano[name]) {
      try {
        const api = await w.cardano[name].enable();
        const used = await api.getUsedAddresses();
        if (used?.length) return used[0]; // hex or bech32 depending on wallet
        const change = await api.getChangeAddress();
        return change ?? null;
      } catch { /* wallet rejected */ }
    }
  }
  return null;
}

export function walletName(): string | null {
  const w = window as any;
  if (!w.cardano) return null;
  const preferred = ["eternl", "nami", "lace", "flint", "typhon", "gerowallet"];
  for (const name of preferred) {
    if (w.cardano[name]) return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return null;
}
