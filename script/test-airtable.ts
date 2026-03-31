/**
 * Push test data to all 4 Airtable tables.
 *
 * Run:
 *   AIRTABLE_SETUP_TOKEN=pat... npx tsx script/test-airtable.ts
 */

import https from "https";

const BASE_ID = process.env.VITE_AIRTABLE_BASE_ID ?? "appeY5l78u3iWJlL0";
const TOKEN =
  process.env.AIRTABLE_SETUP_TOKEN ??
  process.env.VITE_AIRTABLE_API_KEY ??
  "";

if (!TOKEN) {
  console.error("❌  Set AIRTABLE_SETUP_TOKEN=pat... before running.");
  process.exit(1);
}

function request(
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: "api.airtable.com",
        path,
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode ?? 0, data: raw }); }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function post(table: string, fields: object) {
  const { status, data } = await request(
    "POST",
    `/v0/${BASE_ID}/${encodeURIComponent(table)}`,
    { records: [{ fields }] }
  );
  if (status === 200 || status === 201) {
    const id = data.records?.[0]?.id ?? "?";
    console.log(`  ✓ ${table} — record ${id}`);
    return data.records?.[0];
  } else {
    console.error(`  ✗ ${table} (${status}):`, JSON.stringify(data?.error ?? data));
    return null;
  }
}

async function patch(table: string, recordId: string, fields: object) {
  const { status, data } = await request(
    "PATCH",
    `/v0/${BASE_ID}/${encodeURIComponent(table)}`,
    { records: [{ id: recordId, fields }] }
  );
  if (status === 200) {
    console.log(`  ✓ ${table} PATCH — record ${recordId}`);
  } else {
    console.error(`  ✗ ${table} PATCH (${status}):`, JSON.stringify(data?.error ?? data));
  }
}

async function main() {
  const TEST_GAME_CODE = "TEST-" + Date.now().toString(36).toUpperCase();
  const TODAY = new Date().toISOString().split("T")[0];

  console.log(`\nAirtable Test Data — game code: ${TEST_GAME_CODE}\n`);

  // 1. Sessions
  console.log("Sessions:");
  await post("Sessions", {
    "Game Code": TEST_GAME_CODE,
    "Status": "active",
    "Created At": TODAY,
    "Location": "Nairobi, Kenya",
    "Total Rooms": 0,
    "Total Players": 0,
  });

  // 2. Players (simulate 6 players joining 2 teams)
  console.log("\nPlayers (join-time, score=0):");
  const p1 = await post("Players", {
    "Name": "Alice",
    "Wallet Address": "addr1qx0000001",
    "Team": "Team Alpha",
    "Game Code": TEST_GAME_CODE,
    "Event Date": TODAY,
    "Team Score": 0,
    "Team Rank": 0,
    "NFT Sent": false,
    "NFT Tx Hash": "",
  });
  const p2 = await post("Players", {
    "Name": "Bob",
    "Wallet Address": "addr1qx0000002",
    "Team": "Team Alpha",
    "Game Code": TEST_GAME_CODE,
    "Event Date": TODAY,
    "Team Score": 0,
    "Team Rank": 0,
    "NFT Sent": false,
    "NFT Tx Hash": "",
  });
  const p3 = await post("Players", {
    "Name": "Carol",
    "Wallet Address": "",
    "Team": "Team Beta",
    "Game Code": TEST_GAME_CODE,
    "Event Date": TODAY,
    "Team Score": 0,
    "Team Rank": 0,
    "NFT Sent": false,
    "NFT Tx Hash": "",
  });

  // 3. Simulate game end — PATCH existing players with final scores
  console.log("\nPlayers (score update via PATCH):");
  if (p1?.id) await patch("Players", p1.id, { "Team Score": 3200, "Team Rank": 1 });
  if (p2?.id) await patch("Players", p2.id, { "Team Score": 3200, "Team Rank": 1 });
  if (p3?.id) await patch("Players", p3.id, { "Team Score": 2100, "Team Rank": 2 });

  // 4. Results (one row per team)
  console.log("\nResults:");
  await post("Results", {
    "Team Name": "Team Alpha",
    "Leader Name": "Alice",
    "Score": 3200,
    "Rank": 1,
    "Members": "Alice, Bob",
    "Wallet Addresses": "addr1qx0000001, addr1qx0000002",
    "Game Code": TEST_GAME_CODE,
    "Event Date": TODAY,
    "Total Questions": 15,
  });
  await post("Results", {
    "Team Name": "Team Beta",
    "Leader Name": "Carol",
    "Score": 2100,
    "Rank": 2,
    "Members": "Carol",
    "Wallet Addresses": "",
    "Game Code": TEST_GAME_CODE,
    "Event Date": TODAY,
    "Total Questions": 15,
  });

  // 5. Events (one row per game)
  console.log("\nEvents:");
  await post("Events", {
    "Event Name": `Cardano NBO Meetup — ${TODAY}`,
    "Date": TODAY,
    "Game Code": TEST_GAME_CODE,
    "Location": "Nairobi, Kenya",
    "Total Teams": 2,
    "Total Players": 3,
    "Winner": "Team Alpha",
  });

  console.log(`\nDone. Search for game code "${TEST_GAME_CODE}" in Airtable to verify.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
