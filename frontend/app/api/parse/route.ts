import { NextResponse } from "next/server";
import { extractText } from "unpdf";
import mammoth from "mammoth";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let text = "";

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      // Parse PDF
      const pdfBuffer = new Uint8Array(arrayBuffer);
      const { text: extracted } = await extractText(pdfBuffer);
      // unpdf extractText might return an array or string depending on version, 
      // typically it returns { totalPages, text: string | string[] }
      text = Array.isArray(extracted) ? extracted.join("\n") : (extracted as string || "");
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      file.name.endsWith(".docx")
    ) {
      // Parse DOCX
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json({ error: "Unsupported file type. Please upload a PDF or DOCX." }, { status: 400 });
    }

    // Clean up excessive whitespace
    const cleanedText = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({ text: cleanedText });
  } catch (error) {
    console.error("Parse Error:", error);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
