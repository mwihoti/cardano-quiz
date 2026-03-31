/**
 * Creates the three Airtable tables needed by Cardano Quiz.
 *
 * Run once:
 *   AIRTABLE_SETUP_TOKEN=pat... npx tsx script/setup-airtable.ts
 *
 * Token scopes needed (airtable.com/create/tokens):
 *   • schema.bases:write   ← create tables
 *   • data.records:read    ← for the app
 *   • data.records:write   ← for the app
 * Base access: select your Cardano-quiz base
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

// ─── Table definitions ────────────────────────────────────────────────────────

const TABLES = [
  {
    name: "Events",
    fields: [
      { name: "Event Name",    type: "singleLineText" },
      { name: "Date",          type: "singleLineText" },
      { name: "Game Code",     type: "singleLineText" },
      { name: "Location",      type: "singleLineText" },
      { name: "Total Teams",   type: "number", options: { precision: 0 } },
      { name: "Total Players", type: "number", options: { precision: 0 } },
      { name: "Winner",        type: "singleLineText" },
    ],
  },
  {
    name: "Results",
    fields: [
      { name: "Team Name",       type: "singleLineText" },
      { name: "Leader Name",     type: "singleLineText" },
      { name: "Score",           type: "number", options: { precision: 0 } },
      { name: "Rank",            type: "number", options: { precision: 0 } },
      { name: "Members",         type: "multilineText" },
      { name: "Wallet Addresses",type: "multilineText" },
      { name: "Game Code",       type: "singleLineText" },
      { name: "Event Date",      type: "singleLineText" },
      { name: "Total Questions", type: "number", options: { precision: 0 } },
    ],
  },
  {
    name: "Players",
    fields: [
      { name: "Name",           type: "singleLineText" },
      { name: "Wallet Address", type: "singleLineText" },
      { name: "Team",           type: "singleLineText" },
      { name: "Game Code",      type: "singleLineText" },
      { name: "Event Date",     type: "singleLineText" },
      { name: "Team Score",     type: "number", options: { precision: 0 } },
      { name: "Team Rank",      type: "number", options: { precision: 0 } },
      { name: "NFT Sent",       type: "checkbox", options: { icon: "check", color: "greenBright" } },
      { name: "NFT Tx Hash",    type: "singleLineText" },
    ],
  },
  {
    name: "Sessions",
    fields: [
      { name: "Game Code",     type: "singleLineText" },
      { name: "Status",        type: "singleLineText" },
      { name: "Created At",    type: "singleLineText" },
      { name: "Location",      type: "singleLineText" },
      { name: "Total Rooms",   type: "number", options: { precision: 0 } },
      { name: "Total Players", type: "number", options: { precision: 0 } },
    ],
  },
];

// ─── HTTPS helper (avoids fetch version issues) ───────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nAirtable Setup — base: ${BASE_ID}\n`);

  for (const table of TABLES) {
    const { status, data } = await request(
      "POST",
      `/v0/meta/bases/${BASE_ID}/tables`,
      { name: table.name, fields: table.fields }
    );

    if (status === 200 || status === 201) {
      console.log(`  ✓ Created "${table.name}"`);
    } else if (
      status === 422 &&
      typeof data?.error?.message === "string" &&
      data.error.message.toLowerCase().includes("already exist")
    ) {
      console.log(`  ● "${table.name}" already exists — skipped`);
    } else {
      console.error(`  ✗ "${table.name}" failed (${status}):`, JSON.stringify(data?.error ?? data));
    }
  }

  console.log("\nDone. Check your Airtable base to confirm the tables.");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
