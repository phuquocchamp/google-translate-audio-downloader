import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EntryType } from "../input/parseInput.ts";

export type Status = "ok" | "skipped" | "failed" | "planned";

export interface ManifestRow {
  index: number;
  line: number;
  text: string;
  lang: string;
  type: EntryType;
  file: string;
  bytes: number;
  status: Status;
  error?: string;
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ManifestRow[]): string {
  const cols: (keyof ManifestRow)[] = ["index", "line", "text", "lang", "type", "file", "bytes", "status", "error"];
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
}

async function readExisting(path: string): Promise<ManifestRow[]> {
  try {
    const data = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Write manifest.json / manifest.csv for a language folder. Rows from earlier runs
 * (other input files) are kept, so the manifest always covers every mp3 in the folder.
 * Rows are keyed by `file`; this run's rows come first in input order. failed.txt only
 * lists failures from this run, so it can be fed straight back as input.
 */
export async function writeManifest(langDir: string, rows: ManifestRow[], rawById: Map<number, string>): Promise<void> {
  await mkdir(langDir, { recursive: true });
  const jsonPath = join(langDir, "manifest.json");
  const current = [...rows].sort((a, b) => a.index - b.index);
  const currentFiles = new Set(current.map((r) => r.file));
  const older = (await readExisting(jsonPath)).filter((r) => !currentFiles.has(r.file) && r.status !== "failed");
  const sorted = [...current, ...older].map((r, i) => ({ ...r, index: i + 1 }));
  // UTF-8 BOM on the CSV so Excel opens accented / CJK text correctly.
  await writeFile(jsonPath, JSON.stringify(sorted, null, 2) + "\n");
  await writeFile(join(langDir, "manifest.csv"), "﻿" + toCsv(sorted));
  const failed = current.filter((r) => r.status === "failed");
  const failedPath = join(langDir, "failed.txt");
  if (failed.length) {
    await writeFile(failedPath, failed.map((r) => rawById.get(r.index) ?? r.text).join("\n") + "\n");
  } else {
    await rm(failedPath, { force: true });
  }
}
