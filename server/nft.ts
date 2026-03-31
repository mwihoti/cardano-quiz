// ─── NMKR NFT Minting ─────────────────────────────────────────────────────────
// Server-side only — NMKR_API_KEY never reaches the browser
// Docs: https://studio-api.nmkr.io/swagger
//
// To switch from testnet → mainnet:
//   1. Create a new project in NMKR on Mainnet
//   2. Change NMKR_PROJECT_UID to the new project UID
//   3. Change NMKR_NETWORK=mainnet
//   No code changes needed.

const NMKR_API_KEY    = process.env.NMKR_API_KEY;
const NMKR_PROJECT_UID = process.env.NMKR_PROJECT_UID;
const NMKR_NETWORK    = process.env.NMKR_NETWORK ?? "preprod"; // "preprod" | "mainnet"

// NMKR uses the same API host for both networks —
// the network is determined by which project UID you use.
const NMKR_BASE = "https://studio-api.nmkr.io/v2";

export interface MintResult {
  address: string;
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface NmkrStatus {
  configured: boolean;
  network: string;
  projectUid: string | null;
}

function nmkrHeaders() {
  return {
    Authorization: `Bearer ${NMKR_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export function isNmkrConfigured(): boolean {
  return !!(NMKR_API_KEY && NMKR_PROJECT_UID);
}

export function getNmkrStatus(): NmkrStatus {
  return {
    configured: isNmkrConfigured(),
    network: NMKR_NETWORK,
    projectUid: NMKR_PROJECT_UID ?? null,
  };
}

/**
 * Mint one participation NFT and send it to a Cardano wallet address.
 * MintAndSendRandom picks one available NFT from the project and sends it.
 */
export async function mintParticipationNft(walletAddress: string): Promise<MintResult> {
  if (!isNmkrConfigured()) {
    return { address: walletAddress, success: false, error: "NMKR not configured on server" };
  }

  try {
    const url = `${NMKR_BASE}/MintAndSendRandom/${NMKR_PROJECT_UID}/1/${encodeURIComponent(walletAddress)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: nmkrHeaders(),
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { errorMessage: text }; }

    if (!res.ok) {
      return {
        address: walletAddress,
        success: false,
        error: data?.errorMessage ?? data?.title ?? `NMKR ${res.status}`,
      };
    }

    // NMKR returns the tx info inside nft2sendInfos array
    const txHash =
      data?.nft2sendInfos?.[0]?.mintTransactionId ??
      data?.nft2sendInfos?.[0]?.sendTransactionId ??
      data?.txHash ??
      "queued";

    return { address: walletAddress, success: true, txHash };
  } catch (e) {
    return {
      address: walletAddress,
      success: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

/**
 * Batch mint NFTs to multiple addresses.
 * Adds 400ms delay between calls to respect NMKR rate limits.
 */
export async function batchMintNfts(addresses: string[]): Promise<MintResult[]> {
  const results: MintResult[] = [];
  for (const address of addresses) {
    const result = await mintParticipationNft(address);
    results.push(result);
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}
