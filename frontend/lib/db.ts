import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * Local persistence layer (Stage 3): SQLite for metadata, disk for audio.
 *
 * Layout (override the root with DATA_DIR):
 *   <DATA_DIR>/focusreader.db   — track metadata
 *   <DATA_DIR>/audio/<id>.mp3   — generated MP3s
 *
 * The connection is cached on globalThis so Next.js dev-mode hot reloads
 * don't open a new handle per recompile.
 */
// Resolved lazily (not at module load) so tests can point different suites
// at isolated directories before first use.
function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

function audioDir(): string {
  return path.join(dataDir(), "audio");
}

declare global {
  // eslint-disable-next-line no-var
  var __focusreaderDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  fs.mkdirSync(audioDir(), { recursive: true });
  const db = new Database(path.join(dataDir(), "focusreader.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      chars       INTEGER NOT NULL,
      speed       REAL NOT NULL DEFAULT 1.0,
      background  TEXT NOT NULL DEFAULT 'silence',
      status      TEXT NOT NULL DEFAULT 'processing',
      size_bytes  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      delta       INTEGER NOT NULL,
      reason      TEXT NOT NULL,
      ref         TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_dedupe
      ON credit_ledger(reason, ref) WHERE ref IS NOT NULL;

    CREATE TABLE IF NOT EXISTS jobs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      track_id    TEXT NOT NULL,
      text        TEXT NOT NULL,
      speed       REAL NOT NULL DEFAULT 1.0,
      background  TEXT NOT NULL DEFAULT 'silence',
      status      TEXT NOT NULL DEFAULT 'queued',
      error       TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      note        TEXT NOT NULL,
      source      TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS reader_docs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      doc_type    TEXT NOT NULL DEFAULT 'pdf',
      num_pages   INTEGER NOT NULL DEFAULT 1,
      current_page INTEGER NOT NULL DEFAULT 1,
      current_chunk INTEGER NOT NULL DEFAULT 0,
      total_words INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reader_docs_user ON reader_docs(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS imports (
      id          TEXT PRIMARY KEY,
      text        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS extension_tokens (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ext_tokens_user ON extension_tokens(user_id);
  `);
  // Additive migrations for databases created before these columns existed.
  try {
    db.exec(
      `ALTER TABLE jobs ADD COLUMN checkpoints INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    // Column already exists.
  }
  try {
    // Source text is kept so the player can render read-along highlighting.
    db.exec(`ALTER TABLE tracks ADD COLUMN text TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists.
  }
  try {
    db.exec(`ALTER TABLE tracks ADD COLUMN source_url TEXT DEFAULT NULL`);
  } catch {
    // Column already exists.
  }
  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__focusreaderDb) {
    globalThis.__focusreaderDb = createDb();
  }
  return globalThis.__focusreaderDb;
}

/** Test-only: close and drop the cached connection so a suite can re-point
 *  DATA_DIR at a fresh directory. */
export function __resetDbForTests(): void {
  globalThis.__focusreaderDb?.close();
  globalThis.__focusreaderDb = undefined;
}

export interface Track {
  id: string;
  user_id: string;
  title: string;
  chars: number;
  speed: number;
  background: string;
  status: "processing" | "ready" | "failed";
  size_bytes: number;
  created_at: string;
  text: string;
  source_url?: string | null;
}

export function audioPathFor(trackId: string): string {
  return path.join(audioDir(), `${trackId}.mp3`);
}

export function createTrack(params: {
  userId: string;
  title: string;
  chars: number;
  speed: number;
  background: string;
  text?: string;
  sourceUrl?: string | null;
}): Track {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO tracks (id, user_id, title, chars, speed, background, status, text, source_url)
       VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?)`
    )
    .run(
      id,
      params.userId,
      params.title,
      params.chars,
      params.speed,
      params.background,
      params.text ?? "",
      params.sourceUrl ?? null
    );
  return getTrack(id, params.userId) as Track;
}

export function markTrackReady(id: string, sizeBytes: number): void {
  getDb()
    .prepare(`UPDATE tracks SET status = 'ready', size_bytes = ? WHERE id = ?`)
    .run(sizeBytes, id);
}

export function markTrackFailed(id: string): void {
  getDb().prepare(`UPDATE tracks SET status = 'failed' WHERE id = ?`).run(id);
}

export function getTrack(id: string, userId: string): Track | undefined {
  return getDb()
    .prepare(`SELECT * FROM tracks WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Track | undefined;
}

export function listTracks(userId: string, limit = 50): Omit<Track, "text">[] {
  // `text` is deliberately excluded — it can be 200k chars per row and the
  // list view doesn't need it; the karaoke player fetches it per-track.
  return getDb()
    .prepare(
      `SELECT id, user_id, title, chars, speed, background, status, size_bytes, created_at, source_url
       FROM tracks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, limit) as Omit<Track, "text">[];
}

// ---------------------------------------------------------------------------
// Credit ledger — the transactional source of truth for balances.
//
// Every change is an append-only row; the balance is SUM(delta). Grants carry
// a (reason, ref) pair covered by a unique index, so redelivered Stripe
// webhooks physically cannot double-grant. Spends run inside a synchronous
// better-sqlite3 transaction: check-then-insert is atomic, which closes the
// read-modify-write race the old Clerk-metadata counter had.
// ---------------------------------------------------------------------------

export type LedgerReason =
  | "grant_checkout"
  | "grant_renewal"
  | "signup_bonus"
  | "spend_tts"
  | "refund_tts"
  | "revoke_cancel"
  | "migration";

export function getCreditBalance(userId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) AS balance FROM credit_ledger WHERE user_id = ?`
    )
    .get(userId) as { balance: number };
  return row.balance;
}

export function hasLedgerHistory(userId: string): boolean {
  return (
    getDb()
      .prepare(`SELECT 1 FROM credit_ledger WHERE user_id = ? LIMIT 1`)
      .get(userId) !== undefined
  );
}

/**
 * Adds credits. Idempotent when `ref` is provided: a second call with the
 * same (reason, ref) is a no-op. Returns whether a row was actually inserted.
 */
export function grantCredits(
  userId: string,
  amount: number,
  reason: LedgerReason,
  ref?: string
): boolean {
  const info = getDb()
    .prepare(
      `INSERT OR IGNORE INTO credit_ledger (user_id, delta, reason, ref)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, amount, reason, ref ?? null);
  return info.changes > 0;
}

/**
 * Atomically spends credits. Returns the new balance, or null if the user
 * has insufficient funds (in which case nothing is written).
 */
export function spendCredits(
  userId: string,
  amount: number,
  ref: string
): number | null {
  const db = getDb();
  const spend = db.transaction((): number | null => {
    const { balance } = db
      .prepare(
        `SELECT COALESCE(SUM(delta), 0) AS balance FROM credit_ledger WHERE user_id = ?`
      )
      .get(userId) as { balance: number };

    if (balance < amount) return null;

    db.prepare(
      `INSERT INTO credit_ledger (user_id, delta, reason, ref)
       VALUES (?, ?, 'spend_tts', ?)`
    ).run(userId, -amount, ref);

    return balance - amount;
  });
  return spend();
}

/** Zeroes the balance (subscription canceled). Idempotent per ref. */
export function revokeAllCredits(userId: string, ref: string): void {
  const db = getDb();
  db.transaction(() => {
    const balance = getCreditBalance(userId);
    if (balance > 0) {
      db.prepare(
        `INSERT OR IGNORE INTO credit_ledger (user_id, delta, reason, ref)
         VALUES (?, ?, 'revoke_cancel', ?)`
      ).run(userId, -balance, ref);
    }
  })();
}

// ---------------------------------------------------------------------------
// Job queue — async generation for long documents.
// ---------------------------------------------------------------------------

export interface Job {
  id: string;
  user_id: string;
  track_id: string;
  text: string;
  speed: number;
  background: string;
  checkpoints: number;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function createJob(params: {
  userId: string;
  trackId: string;
  text: string;
  speed: number;
  background: string;
  checkpoints?: boolean;
}): Job {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO jobs (id, user_id, track_id, text, speed, background, checkpoints)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.userId,
      params.trackId,
      params.text,
      params.speed,
      params.background,
      params.checkpoints ? 1 : 0
    );
  return getJob(id, params.userId) as Job;
}

export function getJob(id: string, userId: string): Job | undefined {
  return getDb()
    .prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Job | undefined;
}

/**
 * Atomically claims the oldest queued job (marks it running) so multiple
 * worker ticks can never grab the same job twice.
 */
export function claimNextJob(): Job | undefined {
  const db = getDb();
  return db.transaction((): Job | undefined => {
    const job = db
      .prepare(
        `SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1`
      )
      .get() as Job | undefined;
    if (!job) return undefined;
    db.prepare(
      `UPDATE jobs SET status = 'running', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    ).run(job.id);
    return { ...job, status: "running" };
  })();
}

export function finishJob(id: string, error?: string): void {
  getDb()
    .prepare(
      `UPDATE jobs SET status = ?, error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    )
    .run(error ? "failed" : "done", error ?? null, id);
}

export function deleteTrack(id: string, userId: string): boolean {
  const info = getDb()
    .prepare(`DELETE FROM tracks WHERE id = ? AND user_id = ?`)
    .run(id, userId);
  if (info.changes > 0) {
    fs.rmSync(audioPathFor(id), { force: true });
    return true;
  }
  return false;
}

export interface Note {
  id: string;
  user_id: string;
  note: string;
  source: string;
  created_at: string;
}

export function createNote(params: {
  userId: string;
  note: string;
  source: string;
}): Note {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO notes (id, user_id, note, source) VALUES (?, ?, ?, ?)`
    )
    .run(id, params.userId, params.note, params.source);
    
  return getDb().prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as Note;
}

export function listNotes(userId: string, limit = 50): Note[] {
  return getDb()
    .prepare(`SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, limit) as Note[];
}

export interface Import {
  id: string;
  text: string;
  created_at: string;
}

const MAX_IMPORT_CHARS = 200000;

export function createImport(text: string): Import {
  const db = getDb();
  // Unauthenticated capture endpoint: keep it from becoming a disk-filler.
  // Imports are claim-once and short-lived; purge anything over an hour old.
  db.prepare(
    `DELETE FROM imports WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')`
  ).run();

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO imports (id, text) VALUES (?, ?)`).run(
    id,
    text.slice(0, MAX_IMPORT_CHARS)
  );
  return db.prepare(`SELECT * FROM imports WHERE id = ?`).get(id) as Import;
}

/** One-time claim: returns the import and deletes it. */
export function claimImport(id: string): Import | undefined {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM imports WHERE id = ?`)
    .get(id) as Import | undefined;
  if (row) db.prepare(`DELETE FROM imports WHERE id = ?`).run(id);
  return row;
}

// ---------------------------------------------------------------------------
// Extension tokens — opaque bearer credentials for the Chrome extension.
//
// The plaintext token (`frk_` + 64 hex chars) is shown to the user exactly
// once and never stored; only its SHA-256 lands in the database. Clerk user
// ids are NOT valid tokens — they are identifiers, not secrets.
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Issues a fresh token for the user, revoking any previous ones. */
export function issueExtensionToken(userId: string): string {
  const token = `frk_${crypto.randomBytes(32).toString("hex")}`;
  const db = getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM extension_tokens WHERE user_id = ?`).run(userId);
    db.prepare(
      `INSERT INTO extension_tokens (token_hash, user_id) VALUES (?, ?)`
    ).run(hashToken(token), userId);
  })();
  return token;
}

/** Resolves a bearer token to a user id, or null if invalid/revoked. */
export function resolveExtensionToken(token: string): string | null {
  if (!token || !token.startsWith("frk_")) return null;
  const db = getDb();
  const row = db
    .prepare(`SELECT user_id FROM extension_tokens WHERE token_hash = ?`)
    .get(hashToken(token)) as { user_id: string } | undefined;
  if (!row) return null;
  db.prepare(
    `UPDATE extension_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash = ?`
  ).run(hashToken(token));
  return row.user_id;
}

export function revokeExtensionTokens(userId: string): void {
  getDb().prepare(`DELETE FROM extension_tokens WHERE user_id = ?`).run(userId);
}

export function getImport(id: string): Import | undefined {
  return getDb().prepare(`SELECT * FROM imports WHERE id = ?`).get(id) as Import | undefined;
}

export interface ReaderDoc {
  id: string;
  user_id: string;
  title: string;
  doc_type: "pdf" | "docx";
  num_pages: number;
  current_page: number;
  current_chunk: number;
  total_words: number;
  created_at: string;
  updated_at: string;
}

export async function createReaderDoc(params: {
  id?: string;
  userId: string;
  title: string;
  docType: "pdf" | "docx";
  numPages: number;
  totalWords: number;
}): Promise<ReaderDoc> {
  const id = params.id || crypto.randomUUID();
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO reader_docs (id, user_id, title, doc_type, num_pages, current_page, current_chunk, total_words, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  ).run(id, params.userId, params.title, params.docType, params.numPages, params.totalWords);
  const doc = db.prepare(`SELECT * FROM reader_docs WHERE id = ? AND user_id = ?`).get(id, params.userId) as ReaderDoc;

  return doc;
}

export async function listReaderDocs(userId: string, limit = 50): Promise<ReaderDoc[]> {
  return getDb()
    .prepare(`SELECT * FROM reader_docs WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`)
    .all(userId, limit) as ReaderDoc[];
}

export async function updateReaderDocProgress(id: string, userId: string, currentPage: number, currentChunk: number): Promise<void> {
  getDb()
    .prepare(
      `UPDATE reader_docs SET current_page = ?, current_chunk = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND user_id = ?`
    )
    .run(currentPage, currentChunk, id, userId);
}

export async function deleteReaderDoc(id: string, userId: string): Promise<boolean> {
  const info = getDb()
    .prepare(`DELETE FROM reader_docs WHERE id = ? AND user_id = ?`)
    .run(id, userId);

  return info.changes > 0;
}

