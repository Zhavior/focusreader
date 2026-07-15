const express = require("express");
const zod = require("zod");
const {
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
} = require("../services/db.service");
const { ValidationError, NotFoundError } = require("../utils/errors");

const router = express.Router();

// Validation Schemas
const createDocSchema = zod.object({
  title: zod.string().min(1, "Document title is required"),
  fileUrl: zod.string().optional().nullable(),
  docType: zod.enum(["pdf", "docx", "txt", "web"]).default("pdf"),
  totalPages: zod.number().int().min(1).default(1),
  totalWords: zod.number().int().min(0).default(0),
  chunks: zod.array(zod.object({
    chunkIdx: zod.number().int(),
    pageIdx: zod.number().int().optional(),
    text: zod.string(),
    startWordIdx: zod.number().int().optional(),
    endWordIdx: zod.number().int().optional(),
    wordTokens: zod.any().optional(),
  })).optional(),
});

const progressSchema = zod.object({
  currentPage: zod.number().int().min(1).optional(),
  currentChunk: zod.number().int().min(0).optional(),
  activeWordIdx: zod.number().int().min(0).optional(),
  bionicMode: zod.boolean().optional(),
  speed: zod.number().min(0.25).max(4.0).optional(),
  voiceId: zod.string().optional(),
});

const noteSchema = zod.object({
  pageIdx: zod.number().int().min(1).default(1),
  noteText: zod.string().min(1, "Note text is required"),
  quoteText: zod.string().optional().nullable(),
});

// Helper to ensure request user ID exists
function requireUser(req) {
  const userId = req.user?.id || req.headers["x-user-id"] || req.query.userId;
  if (!userId) {
    const err = new Error("User authentication required (`req.user.id` or `x-user-id`)");
    err.statusCode = 401;
    throw err;
  }
  return String(userId);
}

// GET /api/docs - List documents for active user
router.get("/", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const limit = parseInt(req.query.limit || "50", 10);
    const docs = await listDocuments(userId, limit);
    res.json({ success: true, docs });
  } catch (err) {
    next(err);
  }
});

// POST /api/docs - Register a document and its parsed chunks
router.post("/", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const parseResult = createDocSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError("Invalid document registration payload", parseResult.error.errors);
    }
    const data = parseResult.data;
    const doc = await createDocument({
      userId,
      title: data.title,
      fileUrl: data.fileUrl,
      docType: data.docType,
      totalPages: data.totalPages,
      totalWords: data.totalWords,
    });

    let chunksCount = 0;
    if (data.chunks && data.chunks.length > 0) {
      chunksCount = await saveDocumentChunks(doc.id, data.chunks);
    }

    res.status(201).json({ success: true, doc, chunksSaved: chunksCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/docs/:id - Get full document bundle (doc + chunks + reading progress)
router.get("/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const doc = await getDocument(userId, req.params.id);
    if (!doc) {
      throw new NotFoundError(`Document '${req.params.id}' not found`);
    }
    const chunks = await getDocumentChunks(req.params.id);
    const progress = await getReadingProgress(userId, req.params.id);
    res.json({ success: true, doc, chunks, progress });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/docs/:id - Delete document and all associated data
router.delete("/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const deleted = await deleteDocument(userId, req.params.id);
    if (!deleted) {
      throw new NotFoundError(`Document '${req.params.id}' not found or not owned by user`);
    }
    res.json({ success: true, deleted: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/docs/:id/progress - Get reading progress across devices
router.get("/:id/progress", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const progress = await getReadingProgress(userId, req.params.id);
    res.json({ success: true, progress: progress || {} });
  } catch (err) {
    next(err);
  }
});

// PUT /api/docs/:id/progress - Upsert reading progress across devices
router.put("/:id/progress", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const parseResult = progressSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError("Invalid reading progress payload", parseResult.error.errors);
    }
    const progress = await upsertReadingProgress(userId, req.params.id, parseResult.data);
    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
});

// GET /api/docs/:id/notes - List study notes
router.get("/:id/notes", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const notes = await listStudyNotes(userId, req.params.id);
    res.json({ success: true, notes });
  } catch (err) {
    next(err);
  }
});

// POST /api/docs/:id/notes - Create study note
router.post("/:id/notes", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const parseResult = noteSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError("Invalid study note payload", parseResult.error.errors);
    }
    const data = parseResult.data;
    const note = await createStudyNote({
      userId,
      documentId: req.params.id,
      pageIdx: data.pageIdx,
      noteText: data.noteText,
      quoteText: data.quoteText,
    });
    res.status(201).json({ success: true, note });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
