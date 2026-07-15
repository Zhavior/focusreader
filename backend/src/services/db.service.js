const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

let prisma = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")) {
  try {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient();
    console.log("[DbService] Connected to PostgreSQL via Prisma ORM");
  } catch (e) {
    console.warn("[DbService] Could not initialize PrismaClient, falling back to SQLite:", e.message);
  }
}

const DB_PATH =
  process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "focusreader.db")
    : path.join(__dirname, "../../../frontend/data/focusreader.db");

function initSqliteTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      subscription_tier TEXT DEFAULT 'free',
      credits_remaining INTEGER DEFAULT 10000,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_dedupe ON credit_ledger(reason, ref) WHERE ref IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger(user_id);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      file_url TEXT,
      doc_type TEXT DEFAULT 'pdf',
      total_pages INTEGER DEFAULT 1,
      total_words INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ready',
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      chunk_idx INTEGER NOT NULL,
      page_idx INTEGER DEFAULT 1,
      text TEXT NOT NULL,
      start_word_idx INTEGER DEFAULT 0,
      end_word_idx INTEGER DEFAULT 0,
      word_tokens_json TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(document_id, chunk_idx)
    );
    CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks(document_id);

    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      current_page INTEGER DEFAULT 1,
      current_chunk INTEGER DEFAULT 0,
      active_word_idx INTEGER DEFAULT 0,
      bionic_mode INTEGER DEFAULT 1,
      speed REAL DEFAULT 1.0,
      voice_id TEXT DEFAULT 'en-US-JennyNeural',
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(user_id, document_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id);

    CREATE TABLE IF NOT EXISTS study_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      page_idx INTEGER DEFAULT 1,
      note_text TEXT NOT NULL,
      quote_text TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_study_notes_doc ON study_notes(user_id, document_id);
  `);
}

let _sqliteDb = null;
function getSqliteDb() {
  if (!_sqliteDb) {
    _sqliteDb = new Database(DB_PATH);
    _sqliteDb.pragma("journal_mode = WAL");
    _sqliteDb.pragma("synchronous = NORMAL");
    _sqliteDb.pragma("busy_timeout = 10000");
    initSqliteTables(_sqliteDb);
  }
  return _sqliteDb;
}

function closeDb() {
  if (_sqliteDb) {
    try { _sqliteDb.close(); } catch (e) { /* ignore */ }
    _sqliteDb = null;
  }
  if (prisma) {
    try { prisma.$disconnect(); } catch (e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Credit Ledger & Balance Methods
// ---------------------------------------------------------------------------

async function getBalance(userId) {
  if (!userId) return 0;
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: String(userId) },
        select: { creditsRemaining: true },
      });
      return user ? user.creditsRemaining : 0;
    } catch (e) {
      console.error("[DbService] Prisma getBalance error:", e.message);
    }
  }

  const row = getSqliteDb()
    .prepare("SELECT COALESCE(SUM(delta), 0) AS balance FROM credit_ledger WHERE user_id = ?")
    .get(String(userId));
  return row ? row.balance : 0;
}

async function spendCredits(userId, amount, ref = null, reason = "spend_tts") {
  if (!userId || amount <= 0) return null;

  if (prisma) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: String(userId) },
          select: { creditsRemaining: true },
        });
        if (!user || user.creditsRemaining < amount) return null;

        const updated = await tx.user.update({
          where: { id: String(userId) },
          data: { creditsRemaining: user.creditsRemaining - amount },
          select: { creditsRemaining: true },
        });

        await tx.creditLedger.create({
          data: {
            userId: String(userId),
            delta: -amount,
            reason: String(reason),
            reference: ref ? String(ref) : null,
          },
        });

        return updated.creditsRemaining;
      });
    } catch (e) {
      console.error("[DbService] Prisma spendCredits error:", e.message);
      return null;
    }
  }

  const db = getSqliteDb();
  const spend = db.transaction(() => {
    const row = db
      .prepare("SELECT COALESCE(SUM(delta), 0) AS balance FROM credit_ledger WHERE user_id = ?")
      .get(String(userId));
    const balance = row ? row.balance : 0;
    if (balance < amount) return null;

    db.prepare(
      "INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (?, ?, ?, ?)"
    ).run(String(userId), -amount, String(reason), ref ? String(ref) : null);
    return balance - amount;
  });

  return spend();
}

async function spendCreditsAtomic(userId, amount, ref = null, reason = "spend_tts") {
  const { InsufficientCreditsError } = require("../utils/errors");
  const result = await spendCredits(userId, amount, ref, reason);
  if (result === null) {
    throw new InsufficientCreditsError("Out of credits — open Billing to upgrade.");
  }
  return result;
}

async function addCredits(userId, amount, reason = "monthly_refill", ref = null) {
  if (!userId || amount <= 0) return 0;

  if (prisma) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { id: String(userId) },
          create: {
            id: String(userId),
            email: `${userId}@hyperfi.ai`,
            creditsRemaining: amount,
          },
          update: {
            creditsRemaining: { increment: amount },
          },
          select: { creditsRemaining: true },
        });

        await tx.creditLedger.create({
          data: {
            userId: String(userId),
            delta: amount,
            reason: String(reason),
            reference: ref ? String(ref) : null,
          },
        });

        return user.creditsRemaining;
      });
    } catch (e) {
      console.error("[DbService] Prisma addCredits error:", e.message);
      return 0;
    }
  }

  const db = getSqliteDb();
  const add = db.transaction(() => {
    db.prepare(
      "INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (?, ?, ?, ?)"
    ).run(String(userId), amount, String(reason), ref ? String(ref) : null);

    const row = db
      .prepare("SELECT COALESCE(SUM(delta), 0) AS balance FROM credit_ledger WHERE user_id = ?")
      .get(String(userId));
    return row ? row.balance : amount;
  });

  return add();
}

// ---------------------------------------------------------------------------
// Document Studio & Multi-Device Sync Methods
// ---------------------------------------------------------------------------

async function createDocument({ id, userId, title, fileUrl = null, docType = "pdf", totalPages = 1, totalWords = 0 }) {
  const docId = id || crypto.randomUUID();
  if (prisma) {
    try {
      await prisma.user.upsert({
        where: { id: String(userId) },
        create: { id: String(userId), email: `${userId}@hyperfi.ai` },
        update: {},
      });
      return await prisma.document.create({
        data: {
          id: docId,
          userId: String(userId),
          title: String(title),
          fileUrl: fileUrl ? String(fileUrl) : null,
          docType: String(docType),
          totalPages: Number(totalPages),
          totalWords: Number(totalWords),
          status: "ready",
        },
      });
    } catch (e) {
      console.error("[DbService] Prisma createDocument error:", e.message);
    }
  }

  const db = getSqliteDb();
  db.prepare(`
    INSERT OR REPLACE INTO documents (id, user_id, title, file_url, doc_type, total_pages, total_words, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(docId, String(userId), String(title), fileUrl ? String(fileUrl) : null, String(docType), Number(totalPages), Number(totalWords));
  
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(docId);
}

async function listDocuments(userId, limit = 50) {
  if (!userId) return [];
  if (prisma) {
    try {
      return await prisma.document.findMany({
        where: { userId: String(userId) },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
    } catch (e) {
      console.error("[DbService] Prisma listDocuments error:", e.message);
    }
  }

  return getSqliteDb()
    .prepare("SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?")
    .all(String(userId), limit);
}

async function getDocument(userId, documentId) {
  if (!userId || !documentId) return null;
  if (prisma) {
    try {
      return await prisma.document.findFirst({
        where: { id: String(documentId), userId: String(userId) },
      });
    } catch (e) {
      console.error("[DbService] Prisma getDocument error:", e.message);
    }
  }

  return getSqliteDb()
    .prepare("SELECT * FROM documents WHERE id = ? AND user_id = ?")
    .get(String(documentId), String(userId)) || null;
}

async function deleteDocument(userId, documentId) {
  if (!userId || !documentId) return false;
  if (prisma) {
    try {
      const res = await prisma.document.deleteMany({
        where: { id: String(documentId), userId: String(userId) },
      });
      return res.count > 0;
    } catch (e) {
      console.error("[DbService] Prisma deleteDocument error:", e.message);
      return false;
    }
  }

  const db = getSqliteDb();
  const info = db.prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").run(String(documentId), String(userId));
  if (info.changes > 0) {
    db.prepare("DELETE FROM document_chunks WHERE document_id = ?").run(String(documentId));
    db.prepare("DELETE FROM reading_progress WHERE document_id = ?").run(String(documentId));
    db.prepare("DELETE FROM study_notes WHERE document_id = ?").run(String(documentId));
    return true;
  }
  return false;
}

async function saveDocumentChunks(documentId, chunks = []) {
  if (!documentId || !Array.isArray(chunks) || chunks.length === 0) return 0;
  if (prisma) {
    try {
      const data = chunks.map((c) => ({
        id: c.id || crypto.randomUUID(),
        documentId: String(documentId),
        chunkIdx: Number(c.chunkIdx),
        pageIdx: Number(c.pageIdx || 1),
        text: String(c.text || ""),
        startWordIdx: Number(c.startWordIdx || 0),
        endWordIdx: Number(c.endWordIdx || 0),
        wordTokensJson: typeof c.wordTokensJson === "string" ? c.wordTokensJson : JSON.stringify(c.wordTokens || []),
      }));
      const res = await prisma.documentChunk.createMany({
        data,
        skipDuplicates: true,
      });
      return res.count;
    } catch (e) {
      console.error("[DbService] Prisma saveDocumentChunks error:", e.message);
    }
  }

  const db = getSqliteDb();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_idx, page_idx, text, start_word_idx, end_word_idx, word_tokens_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let count = 0;
  const tx = db.transaction(() => {
    for (const c of chunks) {
      insert.run(
        c.id || crypto.randomUUID(),
        String(documentId),
        Number(c.chunkIdx),
        Number(c.pageIdx || 1),
        String(c.text || ""),
        Number(c.startWordIdx || 0),
        Number(c.endWordIdx || 0),
        typeof c.wordTokensJson === "string" ? c.wordTokensJson : JSON.stringify(c.wordTokens || [])
      );
      count++;
    }
  });
  tx();
  return count;
}

async function getDocumentChunks(documentId) {
  if (!documentId) return [];
  if (prisma) {
    try {
      return await prisma.documentChunk.findMany({
        where: { documentId: String(documentId) },
        orderBy: { chunkIdx: "asc" },
      });
    } catch (e) {
      console.error("[DbService] Prisma getDocumentChunks error:", e.message);
    }
  }

  return getSqliteDb()
    .prepare("SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_idx ASC")
    .all(String(documentId));
}

async function getReadingProgress(userId, documentId) {
  if (!userId || !documentId) return null;
  if (prisma) {
    try {
      return await prisma.readingProgress.findUnique({
        where: { userId_documentId: { userId: String(userId), documentId: String(documentId) } },
      });
    } catch (e) {
      console.error("[DbService] Prisma getReadingProgress error:", e.message);
    }
  }

  return getSqliteDb()
    .prepare("SELECT * FROM reading_progress WHERE user_id = ? AND document_id = ?")
    .get(String(userId), String(documentId)) || null;
}

async function upsertReadingProgress(userId, documentId, { currentPage = 1, currentChunk = 0, activeWordIdx = 0, bionicMode = true, speed = 1.0, voiceId = "en-US-JennyNeural" }) {
  if (!userId || !documentId) return null;
  if (prisma) {
    try {
      return await prisma.readingProgress.upsert({
        where: { userId_documentId: { userId: String(userId), documentId: String(documentId) } },
        create: {
          userId: String(userId),
          documentId: String(documentId),
          currentPage: Number(currentPage),
          currentChunk: Number(currentChunk),
          activeWordIdx: Number(activeWordIdx),
          bionicMode: Boolean(bionicMode),
          speed: Number(speed),
          voiceId: String(voiceId),
        },
        update: {
          currentPage: Number(currentPage),
          currentChunk: Number(currentChunk),
          activeWordIdx: Number(activeWordIdx),
          bionicMode: Boolean(bionicMode),
          speed: Number(speed),
          voiceId: String(voiceId),
        },
      });
    } catch (e) {
      console.error("[DbService] Prisma upsertReadingProgress error:", e.message);
    }
  }

  const db = getSqliteDb();
  const progId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO reading_progress (id, user_id, document_id, current_page, current_chunk, active_word_idx, bionic_mode, speed, voice_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id, document_id) DO UPDATE SET
      current_page = excluded.current_page,
      current_chunk = excluded.current_chunk,
      active_word_idx = excluded.active_word_idx,
      bionic_mode = excluded.bionic_mode,
      speed = excluded.speed,
      voice_id = excluded.voice_id,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(progId, String(userId), String(documentId), Number(currentPage), Number(currentChunk), Number(activeWordIdx), bionicMode ? 1 : 0, Number(speed), String(voiceId));

  return db.prepare("SELECT * FROM reading_progress WHERE user_id = ? AND document_id = ?").get(String(userId), String(documentId));
}

async function createStudyNote({ id, userId, documentId, pageIdx = 1, noteText, quoteText = null }) {
  if (!userId || !documentId || !noteText) return null;
  const noteId = id || crypto.randomUUID();
  if (prisma) {
    try {
      return await prisma.studyNote.create({
        data: {
          id: noteId,
          userId: String(userId),
          documentId: String(documentId),
          pageIdx: Number(pageIdx),
          noteText: String(noteText),
          quoteText: quoteText ? String(quoteText) : null,
        },
      });
    } catch (e) {
      console.error("[DbService] Prisma createStudyNote error:", e.message);
    }
  }

  const db = getSqliteDb();
  db.prepare(`
    INSERT INTO study_notes (id, user_id, document_id, page_idx, note_text, quote_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(noteId, String(userId), String(documentId), Number(pageIdx), String(noteText), quoteText ? String(quoteText) : null);

  return db.prepare("SELECT * FROM study_notes WHERE id = ?").get(noteId);
}

async function listStudyNotes(userId, documentId) {
  if (!userId || !documentId) return [];
  if (prisma) {
    try {
      return await prisma.studyNote.findMany({
        where: { userId: String(userId), documentId: String(documentId) },
        orderBy: { createdAt: "desc" },
      });
    } catch (e) {
      console.error("[DbService] Prisma listStudyNotes error:", e.message);
    }
  }

  return getSqliteDb()
    .prepare("SELECT * FROM study_notes WHERE user_id = ? AND document_id = ? ORDER BY created_at DESC")
    .all(String(userId), String(documentId));
}

async function resolveExtensionToken(rawToken) {
  try {
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    if (isPrismaConnected && prisma) {
      try {
        const row = await prisma.extensionToken.findUnique({ where: { tokenHash: hash } });
        if (row) return row.userId;
      } catch { /* fallback */ }
    }
    const row = getSqliteDb()
      .prepare("SELECT user_id FROM extension_tokens WHERE token_hash = ?")
      .get(hash);
    return row ? row.user_id : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  getBalance,
  spendCredits,
  spendCreditsAtomic,
  addCredits,
  createDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  saveDocumentChunks,
  getDocumentChunks,
  getReadingProgress,
  upsertReadingProgress,
  createStudyNote,
  listStudyNotes,
  resolveExtensionToken,
  getDb: getSqliteDb,
  closeDb,
};
