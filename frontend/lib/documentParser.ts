import { WordSpan, PageData } from "@/components/reader/ReaderViewport";

export interface ChunkData {
  chunkIdx: number;
  text: string;
  startWordIdx: number;
  endWordIdx: number;
  pageIdx: number;
}

export interface AcousticToken {
  word: string;
  weight: number;
  startFrac: number;
  endFrac: number;
}

/**
 * State-of-the-art acoustic word timing calculation.
 * Accurately models neural speech synthesis cadences, accounting for non-linear word length
 * and punctuation pauses (.?!, ,;:, dashes, quotes).
 */
export function buildWordTimings(text: string): AcousticToken[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const rawWeights = words.map(word => {
    // Base syllabic duration: power curve over character count + baseline offset
    let weight = Math.pow(word.length, 0.78) * 45 + 120;
    
    // Punctuation prosody rules
    if (/[.?!]["']?$/.test(word)) weight += 420;      // full stop sentence boundary
    else if (/[,;:]["']?$/.test(word)) weight += 220; // clause comma/colon delay
    else if (/[—–"-]$/.test(word)) weight += 120;     // dash or quotation boundary
    
    return { word, weight };
  });

  const totalWeight = rawWeights.reduce((sum, w) => sum + w.weight, 0) || 1;
  let cumulative = 0;

  return rawWeights.map(({ word, weight }) => {
    const startFrac = cumulative / totalWeight;
    cumulative += weight;
    const endFrac = cumulative / totalWeight;
    return { word, weight, startFrac, endFrac };
  });
}

/**
 * Heuristic noise detection to filter out running headers, footers, page numbers,
 * watermarks, copyright/confidential stamps, standalone symbols, and figure numbering markers.
 */
export function isNoiseText(str: string, y?: number, pageHeight?: number): boolean {
  const trimmed = str.trim();
  if (!trimmed) return true;

  // 1. Check if near page boundaries (top/bottom 65px on a standard page) AND is short or matches header/footer
  const isBoundary = y !== undefined && pageHeight !== undefined && (y < 65 || y > pageHeight - 65);
  if (isBoundary && trimmed.length < 60) {
    return true;
  }

  // 2. Pure numbering or "Page X of Y" / "X / Y" / "Page X"
  if (/^(page\s*\d+(\s*(of|\/|-)\s*\d+)?|\d+\s*(of|\/)\s*\d+|\b\d{1,3}\b|[-–—]\s*\d+\s*[-–—])$/i.test(trimmed)) {
    return true;
  }

  // 3. Copyrights, watermarks, confidential headers, ISSN/ISBN/DOI identifiers
  if (/^(copyright|©|all rights reserved|confidential|draft|do not distribute|issn|isbn|doi:|http[s]?:\/\/doi\.org)/i.test(trimmed)) {
    return true;
  }

  // 4. Standalone bullet points, dots, grid marks, separators
  if (/^[•▪■♦★☆►●*—–|+~=•\.\s,;:_/\\-]+$/.test(trimmed)) {
    return true;
  }

  // 5. Standalone Figure / Table / Chart caption numbering (e.g. "Figure 3.1:", "Table 2.")
  if (/^(fig(ure)?\.?|table|chart)\s*\d+(\.\d+)*[:\.-]?\s*$/i.test(trimmed)) {
    return true;
  }

  // 6. Tiny isolated non-alphabetic fragments (e.g. "()", "[1]", "*", "1.")
  if (trimmed.length <= 3 && !/[a-zA-Z]{2,}/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Non-blocking text/paragraph parser for DOCX or TXT files.
 * Splits paragraphs cleanly and returns structured chunks + layout items without blocking UI thread.
 */
export async function parseDocxParagraphsAsync(
  paragraphs: string[],
  startPage: number = 1
): Promise<{ pages: PageData[]; chunks: ChunkData[]; totalWords: number }> {
  const pageItems: any[] = [];
  const allChunks: ChunkData[] = [];
  let globalWordCounter = 0;

  // Process in batches of 50 paragraphs to yield to the main thread
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (!p || isNoiseText(p)) continue;

    const words = p.split(/\s+/).filter(Boolean);
    const wordSpans: WordSpan[] = words.map(w => ({
      globalIdx: globalWordCounter++,
      pageIdx: startPage,
      itemIdx: pageItems.length,
      text: w,
      x: 0,
      y: 0,
      width: 0,
      height: 0
    }));

    pageItems.push({
      str: p,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      words: wordSpans
    });

    // Yield every 50 paragraphs
    if (i > 0 && i % 50 === 0) {
      await new Promise(r => setTimeout(r, 5));
    }
  }

  // Group valid wordSpans into fluid 15-55 word acoustic reading chunks
  const allWords: WordSpan[] = pageItems.flatMap(pi => pi.words);
  let currentChunkWords: WordSpan[] = [];
  let chunkIdx = 0;

  allWords.forEach(w => {
    currentChunkWords.push(w);
    const endsWithPunctuation = /[.?!,;:]["']?$/.test(w.text);
    const endsWithSentence = /[.?!]["']?$/.test(w.text);

    if (
      (currentChunkWords.length >= 30 && endsWithPunctuation) ||
      (currentChunkWords.length >= 15 && endsWithSentence) ||
      currentChunkWords.length >= 55
    ) {
      allChunks.push({
        chunkIdx: chunkIdx++,
        text: currentChunkWords.map(cw => cw.text).join(" "),
        startWordIdx: currentChunkWords[0].globalIdx,
        endWordIdx: currentChunkWords[currentChunkWords.length - 1].globalIdx,
        pageIdx: startPage
      });
      currentChunkWords = [];
    }
  });

  if (currentChunkWords.length > 0) {
    allChunks.push({
      chunkIdx: chunkIdx++,
      text: currentChunkWords.map(cw => cw.text).join(" "),
      startWordIdx: currentChunkWords[0].globalIdx,
      endWordIdx: currentChunkWords[currentChunkWords.length - 1].globalIdx,
      pageIdx: startPage
    });
  }

  const pages: PageData[] = [{
    pageNumber: startPage,
    width: 800,
    height: Math.max(1100, pageItems.length * 35),
    items: pageItems
  }];

  return { pages, chunks: allChunks, totalWords: globalWordCounter };
}

/**
 * Non-blocking PDF layout extractor using pdf.js.
 * Extracts word spans, exact canvas coordinates, and reading chunks while yielding
 * regularly to the main UI thread to maintain 60fps scrolling performance.
 */
export async function extractPdfPagesAsync(
  pdf: any,
  maxPages: number = 60,
  onProgress?: (pages: PageData[], chunks: ChunkData[], current: number, total: number) => void
): Promise<{ pages: PageData[]; chunks: ChunkData[]; totalWords: number }> {
  const allPages: PageData[] = [];
  const allChunks: ChunkData[] = [];
  let globalWordIdx = 0;
  let chunkIdx = 0;

  const numPagesToExtract = Math.min(pdf.numPages, maxPages);

  for (let pNum = 1; pNum <= numPagesToExtract; pNum++) {
    try {
      const page = await pdf.getPage(pNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const pageItems: any[] = [];
      const pageValidWords: WordSpan[] = [];

      textContent.items.forEach((item: any) => {
        if (!item.str || !item.str.trim()) return;
        const x = item.transform[4];
        const y = viewport.height - item.transform[5];

        // Check heuristic noise (running headers/footers, page numbers, watermarks, bullets)
        if (isNoiseText(item.str, y, viewport.height)) {
          // Keep as visual background text without assigning audio globalIdx words
          pageItems.push({
            str: item.str,
            x,
            y,
            width: item.width,
            height: item.height,
            words: []
          });
          return;
        }

        const words = item.str.split(/\s+/).filter(Boolean);
        const wordSpans: WordSpan[] = words.map((w: string) => ({
          globalIdx: globalWordIdx++,
          pageIdx: pNum,
          itemIdx: pageItems.length,
          text: w,
          x,
          y,
          width: item.width / Math.max(1, words.length),
          height: item.height
        }));

        pageItems.push({
          str: item.str,
          x,
          y,
          width: item.width,
          height: item.height,
          words: wordSpans
        });

        pageValidWords.push(...wordSpans);
      });

      // Buffer words on this page into fluid paragraph reading chunks
      let currentChunkWords: WordSpan[] = [];
      pageValidWords.forEach(w => {
        currentChunkWords.push(w);
        const endsWithPunctuation = /[.?!,;:]["']?$/.test(w.text);
        const endsWithSentence = /[.?!]["']?$/.test(w.text);

        if (
          (currentChunkWords.length >= 30 && endsWithPunctuation) ||
          (currentChunkWords.length >= 15 && endsWithSentence) ||
          currentChunkWords.length >= 55
        ) {
          allChunks.push({
            chunkIdx: chunkIdx++,
            text: currentChunkWords.map(cw => cw.text).join(" "),
            startWordIdx: currentChunkWords[0].globalIdx,
            endWordIdx: currentChunkWords[currentChunkWords.length - 1].globalIdx,
            pageIdx: pNum
          });
          currentChunkWords = [];
        }
      });

      if (currentChunkWords.length > 0) {
        allChunks.push({
          chunkIdx: chunkIdx++,
          text: currentChunkWords.map(cw => cw.text).join(" "),
          startWordIdx: currentChunkWords[0].globalIdx,
          endWordIdx: currentChunkWords[currentChunkWords.length - 1].globalIdx,
          pageIdx: pNum
        });
      }

      allPages.push({
        pageNumber: pNum,
        width: viewport.width,
        height: viewport.height,
        items: pageItems
      });

      // Notify progress and yield to main thread every 2 pages or on first page
      if (pNum === 1 || pNum % 2 === 0 || pNum === numPagesToExtract) {
        if (onProgress) {
          onProgress([...allPages], [...allChunks], pNum, numPagesToExtract);
        }
        await new Promise(r => setTimeout(r, 6)); // Yield to main UI loop
      }
    } catch (err) {
      console.error(`Error parsing PDF page ${pNum}:`, err);
    }
  }

  return { pages: allPages, chunks: allChunks, totalWords: globalWordIdx };
}
