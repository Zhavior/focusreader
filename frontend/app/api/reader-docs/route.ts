import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { 
  createReaderDoc, 
  listReaderDocs, 
  updateReaderDocProgress, 
  deleteReaderDoc 
} from "@/lib/db";

export const runtime = "nodejs";

// GET /api/reader-docs - list all document sessions for the active user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const docs = await listReaderDocs(userId);
    return NextResponse.json({ success: true, docs });
  } catch (err: any) {
    console.error("GET /api/reader-docs error:", err);
    return NextResponse.json({ error: "Failed to load reader documents" }, { status: 500 });
  }
}

// POST /api/reader-docs - create or update progress for a document session
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();

    if (body.action === "update_progress") {
      if (!body.id) return NextResponse.json({ error: "Missing document id" }, { status: 400 });
      await updateReaderDocProgress(body.id, userId, body.currentPage || 1, body.currentChunk || 0);
      return NextResponse.json({ success: true });
    }

    // Create / register new document session
    if (!body.title || !body.docType) {
      return NextResponse.json({ error: "Missing required document attributes" }, { status: 400 });
    }

    const doc = await createReaderDoc({
      id: body.id,
      userId,
      title: body.title,
      docType: body.docType === "pdf" ? "pdf" : "docx",
      numPages: body.numPages || 1,
      totalWords: body.totalWords || 0
    });

    return NextResponse.json({ success: true, doc });
  } catch (err: any) {
    console.error("POST /api/reader-docs error:", err);
    return NextResponse.json({ error: "Failed to save reader document" }, { status: 500 });
  }
}

// DELETE /api/reader-docs - delete a document session
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const deleted = await deleteReaderDoc(id, userId);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    console.error("DELETE /api/reader-docs error:", err);
    return NextResponse.json({ error: "Failed to delete reader document" }, { status: 500 });
  }
}
