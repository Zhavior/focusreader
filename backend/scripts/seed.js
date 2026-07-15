#!/usr/bin/env node
/**
 * HyperFi TTS Backend — Local SQLite Database Seeding & Prewarming Script
 * Usage: node scripts/seed.js
 */

const { getDb } = require("../src/services/db.service");

async function seedDatabase() {
  console.log("==========================================================================");
  console.log(" Seeding HyperFi Production Database (SQLite / WAL)");
  console.log("==========================================================================");

  const db = await getDb();

  // 1. Seed Sample Users
  const users = [
    { id: "user_titanium_01", email: "architect@hyperfi.dev", tier: "enterprise", credits: 500000 },
    { id: "user_test_pro", email: "pro@hyperfi.dev", tier: "pro", credits: 100000 },
    { id: "user_free_tier", email: "free@hyperfi.dev", tier: "free", credits: 1000 },
  ];

  console.log("\n[1/3] Upserting Sample User Profiles & Credits (`users` table)...");
  for (const u of users) {
    if (db.prepare) {
      db.prepare(`
        INSERT INTO users (id, email, subscription_tier, credits_remaining, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET credits_remaining = excluded.credits_remaining, subscription_tier = excluded.subscription_tier, updated_at = datetime('now')
      `).run(u.id, u.email, u.tier, u.credits);
    }
    console.log(`  -> User: ${u.id.padEnd(20)} | Tier: ${u.tier.padEnd(10)} | Credits: ${u.credits.toLocaleString()}`);
  }

  // 2. Seed Multi-Device Document Studio Documents
  console.log("\n[2/3] Seeding Multi-Device Document Studio Sessions (`documents` & `document_chunks` tables)...");
  const sampleDocs = [
    {
      id: "doc-arch-guide-2026",
      userId: "user_titanium_01",
      title: "HyperFi Production Architecture Guide (v3.0)",
      fileUrl: "https://hyperfi.dev/docs/architecture.pdf",
      totalWords: 1450,
      chunks: [
        { id: "chk-arch-01", idx: 0, text: "Welcome to HyperFi. Our system utilizes a multi-tier fallback architecture ensuring zero-downtime audio streaming across Edge, OpenSource, ElevenLabs, and Local engines." },
        { id: "chk-arch-02", idx: 1, text: "When reading complex documentation, Bionic reading bolding combined with neural acoustic prosody increases reading comprehension speed by up to 35%." }
      ]
    },
    {
      id: "doc-bionic-whitepaper",
      userId: "user_test_pro",
      title: "Bionic Reading & Neural TTS Whitepaper",
      fileUrl: "https://arxiv.org/abs/2026.hyperfi.pdf",
      totalWords: 820,
      chunks: [
        { id: "chk-bio-01", idx: 0, text: "In this paper, we demonstrate that simultaneous visual fixation guiding and auditory reinforcement significantly reduces cognitive fatigue during long study sessions." }
      ]
    }
  ];

  if (db.prepare) {
    for (const doc of sampleDocs) {
      // Insert document
      db.prepare(`
        INSERT OR REPLACE INTO documents (id, user_id, title, file_url, doc_type, total_pages, total_words, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pdf', 1, ?, 'ready', datetime('now'), datetime('now'))
      `).run(doc.id, doc.userId, doc.title, doc.fileUrl, doc.totalWords);

      // Insert chunks
      doc.chunks.forEach((chk) => {
        const tokens = chk.text.split(/\s+/).map((word, i) => ({ word, index: i }));
        db.prepare(`
          INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_idx, page_idx, text, start_word_idx, end_word_idx, word_tokens_json, created_at)
          VALUES (?, ?, ?, 1, ?, 0, ?, ?, datetime('now'))
        `).run(chk.id, doc.id, chk.idx, chk.text, tokens.length, JSON.stringify(tokens));
      });

      // Seed reading progress (`reading_progress` table)
      db.prepare(`
        INSERT OR REPLACE INTO reading_progress (id, user_id, document_id, current_page, current_chunk, active_word_idx, bionic_mode, speed, voice_id, updated_at)
        VALUES (?, ?, ?, 1, 0, 10, 1, 1.25, 'en-US-JennyNeural', datetime('now'))
      `).run(`prog-${doc.id}`, doc.userId, doc.id);

      console.log(`  -> Document: "${doc.title}" (${doc.chunks.length} chunks seeded)`);
    }

    // 3. Seed Study Notes (`study_notes` table)
    console.log("\n[3/3] Seeding Sample Study Notes (`study_notes` table)...");
    db.prepare(`
      INSERT OR REPLACE INTO study_notes (id, user_id, document_id, page_idx, note_text, quote_text, created_at)
      VALUES (?, ?, ?, 1, ?, ?, datetime('now'))
    `).run(
      "note-01",
      "user_titanium_01",
      "doc-arch-guide-2026",
      "Remember to double-check Edge fallback latency metrics when testing on macOS.",
      "multi-tier fallback architecture ensuring zero-downtime audio streaming"
    );
    console.log(`  -> Seeded note for document "doc-arch-guide-2026"`);
  }

  console.log("\n==========================================================================");
  console.log(" Seeding Complete! Local SQLite ledger is ready for testing.");
  console.log("==========================================================================\n");
}

seedDatabase().catch((err) => {
  console.error("Failed to seed database:", err);
  process.exit(1);
});
