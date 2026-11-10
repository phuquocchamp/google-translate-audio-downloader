import { readFile } from "node:fs/promises";
import { DEFAULTS } from "../config.ts";

export type EntryType = "word" | "sentence";

export interface Entry {
  /** 1-based line number in the input file. */
  line: number;
  /** Original line as written (trimmed). */
  raw: string;
  /** Whitespace-normalized text sent to TTS. */
  text: string;
  type: EntryType;
}

export interface ParseResult {
  entries: Entry[];
  duplicates: { line: number; text: string; firstLine: number }[];
}

export function normalizeText(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function classify(text: string, phraseMaxWords: number = DEFAULTS.phraseMaxWords): EntryType {
  return text.split(" ").length <= phraseMaxWords ? "word" : "sentence";
}

export function parseInputText(content: string, phraseMaxWords: number = DEFAULTS.phraseMaxWords): ParseResult {
  const entries: Entry[] = [];
  const duplicates: ParseResult["duplicates"] = [];
  const seen = new Map<string, number>();

  content.replace(/^﻿/, "").split(/\r?\n/).forEach((rawLine, i) => {
    const raw = rawLine.trim();
    if (!raw || raw.startsWith("#")) return;
    const text = normalizeText(raw);
    const key = text.toLowerCase();
    const line = i + 1;
    const firstLine = seen.get(key);
    if (firstLine !== undefined) {
      duplicates.push({ line, text, firstLine });
      return;
    }
    seen.set(key, line);
    entries.push({ line, raw, text, type: classify(text, phraseMaxWords) });
  });

  return { entries, duplicates };
}

export async function parseInputFile(path: string, phraseMaxWords?: number): Promise<ParseResult> {
  return parseInputText(await readFile(path, "utf8"), phraseMaxWords);
}
