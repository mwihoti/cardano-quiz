// ─── Config ───────────────────────────────────────────────────────────────────
// VITE_ prefix = available in browser bundle (intentional for Airtable client calls)
// Do NOT put NMKR_API_KEY here — that stays server-side only

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY as string | undefined;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID ?? "appeY5l78u3iWJlL0";
const BASE = `https://api.airtable.com/v0/${BASE_ID}`;

// Your three tables
const TABLES = {
  events: "Events",
  results: "Results",
  players: "Players",
  sessions: "Sessions",
} as const;

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

function isConfigured(): boolean {
  if (!API_KEY) {
    console.warn("[Airtable] VITE_AIRTABLE_API_KEY not set — skipping.");
    return false;
  }
  return true;
}

async function batchPost(table: string, records: object[]): Promise<void> {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      const res = await fetch(`${BASE}/${encodeURIComponent(table)}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ records: batch }),
      });
      if (!res.ok) console.error(`[Airtable] POST ${table} error:`, await res.text());
    } catch (e) {
      console.error(`[Airtable] POST ${table} network error:`, e);
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AirtableEvent {
  id: string;
  fields: {
    "Event Name": string;
    "Date": string;
    "Game Code": string;
    "Location": string;
    "Total Teams": number;
    "Total Players": number;
    "Winner": string;
  };
}

export interface AirtableResult {
  id: string;
  fields: {
    "Team Name": string;
    "Leader Name": string;
    "Score": number;
    "Rank": number;
    "Members": string;
    "Wallet Addresses": string;
    "Game Code": string;
    "Event Date": string;
    "Total Questions": number;
  };
}

export interface AirtablePlayer {
  id: string;
  fields: {
    "Name": string;
    "Wallet Address": string;
    "Team": string;
    "Game Code": string;
    "Event Date": string;
    "Team Score": number;
    "Team Rank": number;
    "NFT Sent": boolean;
    "NFT Tx Hash": string;
  };
}

// ─── Write: create an event row when a game starts ────────────────────────────

export async function saveEvent(
  gameCode: string,
  totalTeams: number,
  totalPlayers: number,
  winner: string,
  location = "Nairobi, Kenya"
): Promise<void> {
  if (!isConfigured()) return;
  const eventDate = new Date().toISOString().split("T")[0];
  await batchPost(TABLES.events, [
    {
      fields: {
        "Event Name": `Cardano NBO Meetup — ${eventDate}`,
        "Date": eventDate,
        "Game Code": gameCode,
        "Location": location,
        "Total Teams": totalTeams,
        "Total Players": totalPlayers,
        "Winner": winner,
      },
    },
  ]);
}

// ─── Write: save team leaderboard to Results table ────────────────────────────

export async function saveGameResults(
  gameCode: string,
  leaderboard: Array<{
    rank: number;
    name: string;
    score: number;
    members: Array<{ name: string; walletAddress?: string; isLeader: boolean }>;
  }>,
  totalQuestions: number
): Promise<void> {
  if (!isConfigured()) return;

  const eventDate = new Date().toISOString().split("T")[0];

  const records = leaderboard.map((entry) => ({
    fields: {
      "Team Name": entry.name,
      "Leader Name": entry.members.find((m) => m.isLeader)?.name ?? "",
      "Score": entry.score,
      "Rank": entry.rank,
      "Members": entry.members.map((m) => m.name).join(", "),
      "Wallet Addresses": entry.members
        .filter((m) => m.walletAddress)
        .map((m) => m.walletAddress)
        .join(", "),
      "Game Code": gameCode,
      "Event Date": eventDate,
      "Total Questions": totalQuestions,
    },
  }));

  await batchPost(TABLES.results, records);
}

// ─── Write: save every individual player to Players table ─────────────────────
// One row per person — powers NFT distribution

export async function savePlayers(
  gameCode: string,
  leaderboard: Array<{
    rank: number;
    name: string;
    score: number;
    members: Array<{ name: string; walletAddress?: string; isLeader: boolean }>;
  }>
): Promise<void> {
  if (!isConfigured()) return;

  const eventDate = new Date().toISOString().split("T")[0];

  const records = leaderboard.flatMap((entry) =>
    entry.members.map((m) => ({
      fields: {
        "Name": m.name,
        "Wallet Address": m.walletAddress ?? "",
        "Team": entry.name,
        "Game Code": gameCode,
        "Event Date": eventDate,
        "Team Score": entry.score,
        "Team Rank": entry.rank,
        "NFT Sent": false,
        "NFT Tx Hash": "",
      },
    }))
  );

  await batchPost(TABLES.players, records);
}

// ─── Write: mark a player's NFT as sent ──────────────────────────────────────

export async function markNftSent(recordId: string, txHash: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await fetch(`${BASE}/${TABLES.players}/${recordId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        fields: { "NFT Sent": true, "NFT Tx Hash": txHash },
      }),
    });
  } catch (e) {
    console.error("[Airtable] markNftSent error:", e);
  }
}

// ─── Read: players who still need their NFT ──────────────────────────────────

export async function getPendingNftPlayers(gameCode?: string): Promise<AirtablePlayer[]> {
  if (!isConfigured()) return [];
  try {
    let formula = `AND({NFT Sent}=FALSE(), {Wallet Address}!='')`;
    if (gameCode) formula = `AND(${formula}, {Game Code}='${gameCode}')`;
    const url = `${BASE}/${TABLES.players}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=200`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.records ?? [];
  } catch {
    return [];
  }
}

// ─── Read: all players for a given date ──────────────────────────────────────

export async function getPlayersByDate(date: string): Promise<AirtablePlayer[]> {
  if (!isConfigured()) return [];
  try {
    const formula = encodeURIComponent(`{Event Date}='${date}'`);
    const url = `${BASE}/${TABLES.players}?filterByFormula=${formula}&sort[0][field]=Team%20Rank&sort[0][direction]=asc`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.records ?? [];
  } catch {
    return [];
  }
}

// ─── Read: team results ───────────────────────────────────────────────────────

export async function getPastResults(limit = 50): Promise<AirtableResult[]> {
  if (!isConfigured()) return [];
  try {
    const url = `${BASE}/${TABLES.results}?sort[0][field]=Event%20Date&sort[0][direction]=desc&maxRecords=${limit}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.records ?? [];
  } catch {
    return [];
  }
}

export async function getResultsByDate(date: string): Promise<AirtableResult[]> {
  if (!isConfigured()) return [];
  try {
    const formula = encodeURIComponent(`{Event Date}='${date}'`);
    const url = `${BASE}/${TABLES.results}?filterByFormula=${formula}&sort[0][field]=Rank&sort[0][direction]=asc`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.records ?? [];
  } catch {
    return [];
  }
}

// ─── Write: save game session when host creates game ──────────────────────────
export async function saveGameSession(gameCode: string): Promise<void> {
  if (!isConfigured()) return;
  const eventDate = new Date().toISOString().split("T")[0];
  await batchPost(TABLES.sessions, [
    {
      fields: {
        "Game Code": gameCode,
        "Status": "active",
        "Created At": eventDate,
        "Location": "Nairobi, Kenya",
        "Total Rooms": 0,
        "Total Players": 0,
      },
    },
  ]);
}

// ─── Write: save player immediately when they join a room ────────────────────
export async function savePlayerJoin(player: {
  name: string;
  team: string;
  gameCode: string;
  walletAddress?: string;
}): Promise<void> {
  if (!isConfigured() || !player.name || !player.gameCode) return;
  const eventDate = new Date().toISOString().split("T")[0];
  await batchPost(TABLES.players, [
    {
      fields: {
        "Name": player.name,
        "Wallet Address": player.walletAddress ?? "",
        "Team": player.team,
        "Game Code": player.gameCode,
        "Event Date": eventDate,
        "Team Score": 0,
        "Team Rank": 0,
        "NFT Sent": false,
        "NFT Tx Hash": "",
      },
    },
  ]);
}

// ─── Write: update player scores at game end (no duplicates) ─────────────────
// Finds existing join-time records and patches them with final scores.
// Creates records for any player not already in the table.
export async function updatePlayerScores(
  gameCode: string,
  leaderboard: Array<{
    rank: number;
    name: string;
    score: number;
    members: Array<{ name: string; walletAddress?: string; isLeader: boolean }>;
  }>
): Promise<void> {
  if (!isConfigured()) return;

  const eventDate = new Date().toISOString().split("T")[0];

  // 1. Fetch all existing player records for this game
  let existing: AirtablePlayer[] = [];
  try {
    const formula = encodeURIComponent(`{Game Code}='${gameCode}'`);
    const res = await fetch(`${BASE}/${TABLES.players}?filterByFormula=${formula}&maxRecords=200`, {
      headers: headers(),
    });
    if (res.ok) {
      const data = await res.json();
      existing = data.records ?? [];
    }
  } catch { /* ignore */ }

  // 2. Build name → recordId lookup
  const nameToId: Record<string, string> = {};
  existing.forEach((r) => {
    if (r.fields["Name"]) nameToId[r.fields["Name"]] = r.id;
  });

  const updates: Array<{ id: string; fields: object }> = [];
  const creates: object[] = [];

  for (const entry of leaderboard) {
    for (const member of entry.members) {
      const recordId = nameToId[member.name];
      if (recordId) {
        updates.push({
          id: recordId,
          fields: {
            "Team Score": entry.score,
            "Team Rank": entry.rank,
            "Wallet Address": member.walletAddress ?? "",
          },
        });
      } else {
        creates.push({
          fields: {
            "Name": member.name,
            "Wallet Address": member.walletAddress ?? "",
            "Team": entry.name,
            "Game Code": gameCode,
            "Event Date": eventDate,
            "Team Score": entry.score,
            "Team Rank": entry.rank,
            "NFT Sent": false,
            "NFT Tx Hash": "",
          },
        });
      }
    }
  }

  // 3. Batch PATCH existing records (10 per request)
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    try {
      await fetch(`${BASE}/${TABLES.players}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ records: batch }),
      });
    } catch { /* ignore */ }
  }

  // 4. Create records for players not yet in Airtable
  if (creates.length > 0) await batchPost(TABLES.players, creates);
}
