const MAX_CHUNK_CHARS = 5000;

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z0-9"'])/g;

/**
 * Splits raw text into ElevenLabs-safe chunks (<= MAX_CHUNK_CHARS).
 * Prefers splitting on paragraph breaks, then sentence boundaries, then
 * hard word-wrap as a last resort, so audio never breaks mid-sentence
 * unless a single sentence itself exceeds the limit.
 */
function chunkText(rawText, maxChars = MAX_CHUNK_CHARS) {
  const text = rawText.trim().replace(/\r\n/g, "\n");
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

    const sentences = paragraph.split(SENTENCE_BOUNDARY);
    for (const sentence of sentences) {
      const sentenceCandidate = current ? `${current} ${sentence}` : sentence;

      if (sentenceCandidate.length <= maxChars) {
        current = sentenceCandidate;
        continue;
      }

      flush();

      if (sentence.length <= maxChars) {
        current = sentence;
      } else {
        for (let i = 0; i < sentence.length; i += maxChars) {
          chunks.push(sentence.slice(i, i + maxChars).trim());
        }
        current = "";
      }
    }
  }

  flush();
  return chunks;
}

// ~950 chars/minute of spoken English at 1.0x; a "section" targets ~5 minutes
// of listening so ADHD users get a completion checkpoint before attention
// drifts.
const SECTION_TARGET_CHARS = 4750;

/**
 * Builds the full ordered list of speakable chunks for a generation.
 *
 * With checkpoints enabled, the text is divided into ~5-minute sections and a
 * short spoken announcement ("Checkpoint. Starting section 2 of 5.") is
 * inserted between them. Announcements are synthesized by the same voice as
 * the content — same provider, same encoder settings — so the concatenated
 * stream stays a single seamless MP3.
 */
function buildSpeechScript(text, { checkpoints = false } = {}) {
  if (!checkpoints) {
    return chunkText(text, MAX_CHUNK_CHARS);
  }

  const sections = chunkText(text, SECTION_TARGET_CHARS);
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
};
