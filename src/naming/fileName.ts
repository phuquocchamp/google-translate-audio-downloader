import slugifyLib from "@sindresorhus/slugify";
import { DEFAULTS } from "../config.ts";
import { hash8 } from "../utils/hash.ts";
import type { Entry } from "../input/parseInput.ts";

export interface NamedEntry extends Entry {
  /** Path relative to output/<lang>/, using forward slashes. */
  file: string;
}

/** Lowercase ASCII slug: accents stripped, non [a-z0-9] runs -> "-". May be "". */
export function slug(text: string): string {
  // Vietnamese đ/Đ is not decomposed by NFD, map it explicitly.
  const pre = text.replace(/đ/g, "d").replace(/Đ/g, "D").replace(/['’]/g, "");
  return slugifyLib(pre, { lowercase: true, decamelize: false, separator: "-" })
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Cut a slug at a word ("-") boundary so it is at most max chars. */
export function truncateSlug(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const idx = cut.lastIndexOf("-");
  return (idx > 0 ? cut.slice(0, idx) : s.slice(0, max)).replace(/-$/, "");
}

export function entryHash(lang: string, text: string): string {
  return hash8(`${lang}|${text.toLowerCase()}`);
}

export function baseName(entry: Entry, lang: string, sentenceSlugMax: number = DEFAULTS.sentenceSlugMax): string {
  const h = entryHash(lang, entry.text);
  const s = slug(entry.text);
  if (!s) return h;
  if (entry.type === "word") return s;
  return `${truncateSlug(s, sentenceSlugMax)}__${h}`;
}

/**
 * Assign a unique relative file path to every entry.
 * Words: words/<slug>.mp3; on slug collision between different texts -> words/<slug>__<hash8>.mp3
 * Sentences: sentences/<slug50>__<hash8>.mp3. No slug (CJK, emoji...) -> <hash8>.mp3
 */
export function nameEntries(entries: Entry[], lang: string, sentenceSlugMax?: number): NamedEntry[] {
  const used = new Set<string>();
  return entries.map((e) => {
    const dir = e.type === "word" ? "words" : "sentences";
    let name = baseName(e, lang, sentenceSlugMax);
    if (used.has(`${dir}/${name}`)) name = `${name}__${entryHash(lang, e.text)}`;
    // Extremely unlikely (hash collision): add a counter.
    let n = 2;
    const stem = name;
    while (used.has(`${dir}/${name}`)) name = `${stem}-${n++}`;
    used.add(`${dir}/${name}`);
    return { ...e, file: `${dir}/${name}.mp3` };
  });
}
