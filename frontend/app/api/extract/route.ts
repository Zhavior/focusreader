import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_TEXT_LENGTH = 200000;

/**
 * Extracts plain text from an uploaded document so it can be fed into the TTS
 * pipeline. Supports PDF, DOCX, and plain text/markdown. Parsing happens
 * server-side (Node runtime) — the browser only ever sends the raw file.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to upload documents." },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_input", message: "Expected a multipart file upload." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "invalid_input", message: "No file provided." },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: "file_too_large",
        message: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.`,
      },
      { status: 413 }
    );
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";
  try {
    if (name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text: extracted } = await extractText(pdf, { mergePages: true });
      text = extracted;
    } else if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = buffer.toString("utf8");
    } else {
      return NextResponse.json(
        {
          error: "unsupported_type",
          message: "Unsupported file type. Upload a PDF, DOCX, TXT, or MD file.",
        },
        { status: 415 }
      );
    }
  } catch (err) {
    console.error("Document extraction failed:", err);
    return NextResponse.json(
      {
        error: "extraction_failed",
        message:
          "Could not read text from that document. It may be scanned, image-only, or corrupted.",
      },
      { status: 422 }
    );
  }

  const cleaned = text.replace(/\s+\n/g, "\n").trim();

  if (!cleaned) {
    return NextResponse.json(
      {
        error: "no_text",
        message:
          "No selectable text found. Scanned/image PDFs need OCR, which isn't supported yet.",
      },
      { status: 422 }
    );
  }

  const truncated = cleaned.length > MAX_TEXT_LENGTH;
  return NextResponse.json({
    text: truncated ? cleaned.slice(0, MAX_TEXT_LENGTH) : cleaned,
    chars: truncated ? MAX_TEXT_LENGTH : cleaned.length,
    truncated,
  });
}
