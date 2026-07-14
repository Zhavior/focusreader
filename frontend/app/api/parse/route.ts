import { NextResponse } from "next/server";
import { extractText } from "unpdf";
import mammoth from "mammoth";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let arrayBuffer: ArrayBuffer;
    let fileType = "";
    let fileName = "";

    if (contentType.includes("application/json")) {
      const { url } = await req.json();
      if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });
      
      const res = await fetch(url);
      if (!res.ok) return NextResponse.json({ error: "Failed to fetch remote document" }, { status: 400 });
      
      arrayBuffer = await res.arrayBuffer();
      fileType = res.headers.get("content-type") || "";
      fileName = url.split('/').pop() || "";
    } else {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      arrayBuffer = await file.arrayBuffer();
      fileType = file.type;
      fileName = file.name;
    }
    const buffer = Buffer.from(arrayBuffer);
    
    let text = "";

    if (fileType.includes("application/pdf") || fileName.endsWith(".pdf")) {
      // Parse PDF
      const pdfBuffer = new Uint8Array(arrayBuffer);
      const { text: extracted } = await extractText(pdfBuffer);
      // unpdf extractText might return an array or string depending on version, 
      // typically it returns { totalPages, text: string | string[] }
      text = Array.isArray(extracted) ? extracted.join("\n") : (extracted as string || "");
    } else if (
      fileType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") || 
      fileName.endsWith(".docx")
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
