const request = require("supertest");
const express = require("express");
const { closeDb } = require("../../src/services/db.service");
const docsRoutes = require("../../src/routes/docs.routes");
const { errorHandler } = require("../../src/middleware/errorHandler");

const app = express();
app.use(express.json());

// Mock auth middleware injecting a test user header
app.use((req, res, next) => {
  req.user = { id: "test-user-sync-99" };
  next();
});

app.use("/api/docs", docsRoutes);
app.use(errorHandler);

describe("Phase 4 Multi-Device Document Studio Sync API (/api/docs)", () => {
  let createdDocId = null;

  afterAll(() => {
    closeDb();
  });

  test("POST /api/docs — registers document and initial chunks", async () => {
    const payload = {
      title: "Advanced AI Architecture & Agent Systems",
      docType: "pdf",
      totalPages: 15,
      totalWords: 4500,
      chunks: [
        {
          chunkIdx: 0,
          pageIdx: 1,
          text: "Introduction to autonomous agentic loops and tool execution.",
          startWordIdx: 0,
          endWordIdx: 8,
          wordTokens: ["Introduction", "to", "autonomous", "agentic", "loops"],
        },
      ],
    };

    const res = await request(app).post("/api/docs").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.doc.title).toBe(payload.title);
    expect(res.body.chunksSaved).toBe(1);

    createdDocId = res.body.doc.id;
  });

  test("GET /api/docs — lists documents for active user", async () => {
    const res = await request(app).get("/api/docs");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.docs)).toBe(true);
    const found = res.body.docs.find((d) => d.id === createdDocId);
    expect(found).toBeDefined();
    expect(found.title).toBe("Advanced AI Architecture & Agent Systems");
  });

  test("GET /api/docs/:id — retrieves documentbundle including acoustic chunks", async () => {
    const res = await request(app).get(`/api/docs/${createdDocId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.doc.id).toBe(createdDocId);
    expect(res.body.chunks).toHaveLength(1);
    expect(res.body.chunks[0].text).toContain("Introduction to autonomous");
  });

  test("PUT /api/docs/:id/progress — upserts multi-device reading progress", async () => {
    const progressPayload = {
      currentPage: 4,
      currentChunk: 1,
      activeWordIdx: 22,
      bionicMode: true,
      speed: 1.75,
      voiceId: "en-US-AriaNeural",
    };

    const res = await request(app)
      .put(`/api/docs/${createdDocId}/progress`)
      .send(progressPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.progress.current_page || res.body.progress.currentPage).toBe(4);
    expect(res.body.progress.speed).toBe(1.75);
  });

  test("GET /api/docs/:id/progress — fetches synchronized reading progress across devices", async () => {
    const res = await request(app).get(`/api/docs/${createdDocId}/progress`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const prog = res.body.progress;
    expect(prog.current_page || prog.currentPage).toBe(4);
    expect(prog.active_word_idx || prog.activeWordIdx).toBe(22);
  });

  test("POST /api/docs/:id/notes — creates a study note", async () => {
    const notePayload = {
      pageIdx: 4,
      noteText: "Critical architectural insight on tool usage.",
      quoteText: "autonomous agentic loops and tool execution",
    };

    const res = await request(app)
      .post(`/api/docs/${createdDocId}/notes`)
      .send(notePayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.note.note_text || res.body.note.noteText).toBe(notePayload.noteText);
  });

  test("GET /api/docs/:id/notes — lists study notes for document", async () => {
    const res = await request(app).get(`/api/docs/${createdDocId}/notes`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.notes)).toBe(true);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].page_idx || res.body.notes[0].pageIdx).toBe(4);
  });

  test("DELETE /api/docs/:id — cascade deletes document and all sync sessions", async () => {
    const res = await request(app).delete(`/api/docs/${createdDocId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app).get(`/api/docs/${createdDocId}`);
    expect(checkRes.status).toBe(404);
  });
});
