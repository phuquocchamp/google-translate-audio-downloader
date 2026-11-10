export const DEFAULTS = {
  lang: "en",
  outDir: "./output",
  concurrency: 2,
  delayMs: 300,
  retries: 3,
  /** Max characters per TTS request; longer text is chunked and concatenated. */
  maxChunkChars: 200,
  /** Max characters of the slug part of a sentence filename. */
  sentenceSlugMax: 50,
  /** Entries with at most this many words are classified as "word". */
  phraseMaxWords: 1,
} as const;
