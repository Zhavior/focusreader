const MAX_CHUNK_CHARS = 5000;

// ~950 chars/minute of spoken English at 1.0x; a "section" targets ~5 minutes
// of listening so ADHD users get a completion checkpoint before attention drifts.
const SECTION_TARGET_CHARS = 4750;

// Negative lookbehind protects common honorifics and abbreviations from being treated as sentence endings
const ABBREVIATIONS = "Mr|Mrs|Ms|Dr|Prof|Sr|Jr|Gen|Gov|Sgt|Capt|St|Rev|Rep|Sen|vs|e\\.g|i\\.e|etc|a\\.m|p\\.m";
const SENTENCE_BOUNDARY = new RegExp(
  `(?<!\\b(?:${ABBREVIATIONS}))\\.(?=\\s+[A-Z0-9"'])|(?<=[!?])\\s+(?=[A-Z0-9"'])`,
  "g"
);

/**
 * Splits raw text into ElevenLabs-safe chunks (<= MAX_CHUNK_CHARS).
 * Prefers splitting on paragraph breaks, then sentence boundaries, then
 * clean word-wrap as a last resort, so audio never breaks mid-sentence
 * unless a single sentence itself exceeds the limit.
 */
function chunkText(rawText, maxChars = MAX_CHUNK_CHARS) {
  const text = (rawText || "").trim().replace(/\r\n/g, "\n");
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim().length > 0) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    flush();

    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }

    // Split paragraph by safe sentence boundaries
    const parts = paragraph.split(SENTENCE_BOUNDARY);
    for (const part of parts) {
      const sentence = part.trim();
      if (!sentence) continue;

      const sentenceCandidate = current ? `${current} ${sentence}` : sentence;

      if (sentenceCandidate.length <= maxChars) {
        current = sentenceCandidate;
        continue;
      }

      flush();

      if (sentence.length <= maxChars) {
        current = sentence;
      } else {
        // Hard-wrap massive sentences neatly on word boundaries inside the last 200 chars
        let remaining = sentence;
        while (remaining.length > maxChars) {
          let sliceIdx = maxChars;
          const lastSpace = remaining.lastIndexOf(" ", maxChars);
          if (lastSpace > maxChars - 200 && lastSpace > 0) {
            sliceIdx = lastSpace;
          }
          chunks.push(remaining.slice(0, sliceIdx).trim());
          remaining = remaining.slice(sliceIdx).trim();
        }
        if (remaining.length > 0) {
          current = remaining;
        }
      }
    }
  }

  flush();
  return chunks;
}

/**
 * Builds the full ordered list of speakable chunks for a generation.
 *
 * With checkpoints enabled, the text is divided into ~5-minute sections and a
 * short spoken announcement ("Checkpoint reached. Starting section 2 of 5.") is
 * inserted between them. Announcements are synthesized by the same voice as
 * the content — same provider, same encoder settings — so the concatenated
 * stream stays a single seamless MP3.
 */
function buildSpeechScript(text, { checkpoints = false, sectionTargetChars = SECTION_TARGET_CHARS } = {}) {
  if (!checkpoints) {
    return chunkText(text, MAX_CHUNK_CHARS);
  }

  const sections = chunkText(text, sectionTargetChars);
  if (sections.length <= 1) return sections;

  const script = [];
  sections.forEach((section, i) => {
    if (i > 0) {
      script.push(
        `Checkpoint reached. Starting section ${i + 1} of ${sections.length}.`
      );
    }
    script.push(section);
  });
  return script;
}

module.exports = {
  chunkText,
  buildSpeechScript,
  MAX_CHUNK_CHARS,
  SECTION_TARGET_CHARS,
  SENTENCE_BOUNDARY
};
