/**
 * Split text into chunks of at most maxChars, preferring sentence punctuation,
 * then commas/semicolons, then spaces. Never splits inside a word unless the word
 * alone is longer than maxChars.
 */
export function chunkText(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (t.length <= maxChars) return t ? [t] : [];
  const chunks: string[] = [];
  let rest = t;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars + 1);
    let idx = -1;
    // [pattern, keepMatchedChar]: punctuation stays in the chunk, whitespace is a cut point.
    const rules: [RegExp, boolean][] = [
      [/[.!?。！？](?=\s|$)/g, true],
      [/[,;:，、；](?=\s|$)/g, true],
      [/\s/g, false],
    ];
    for (const [re, keep] of rules) {
      let m: RegExpExecArray | null;
      let last = -1;
      while ((m = re.exec(window))) {
        const cut = keep ? m.index + 1 : m.index;
        if (cut <= maxChars) last = cut;
      }
      if (last > 0) { idx = last; break; }
    }
    if (idx <= 0) idx = maxChars;
    chunks.push(rest.slice(0, idx).trim());
    rest = rest.slice(idx).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}
