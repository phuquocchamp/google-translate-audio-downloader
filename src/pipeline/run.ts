import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pLimit from "p-limit";
import { parseInputFile } from "../input/parseInput.ts";
import { nameEntries } from "../naming/fileName.ts";
import type { TtsProvider } from "../tts/TtsProvider.ts";
import { retry, sleep } from "../utils/retry.ts";
import { writeManifest, type ManifestRow } from "./manifest.ts";

export interface RunOptions {
  input: string;
  lang: string;
  outDir: string;
  concurrency: number;
  delayMs: number;
  retries: number;
  force: boolean;
  dryRun: boolean;
  phraseMaxWords: number;
  provider: TtsProvider;
  log?: (msg: string) => void;
  onProgress?: (done: number, total: number, row: ManifestRow) => void;
  onPlanned?: (total: number) => void;
}

export interface RunSummary {
  langDir: string;
  rows: ManifestRow[];
  duplicates: number;
  ok: number;
  skipped: number;
  failed: number;
}

async function fileSize(p: string): Promise<number | null> {
  try {
    const s = await stat(p);
    return s.size > 0 ? s.size : null;
  } catch {
    return null;
  }
}

export async function run(o: RunOptions): Promise<RunSummary> {
  const log = o.log ?? (() => {});
  const { entries, duplicates } = await parseInputFile(o.input, o.phraseMaxWords);
  for (const d of duplicates) log(`duplicate skipped: line ${d.line} "${d.text}" (same as line ${d.firstLine})`);

  const named = nameEntries(entries, o.lang);
  const langDir = join(o.outDir, o.lang);
  const rawById = new Map<number, string>();
  const rows: ManifestRow[] = named.map((e, i) => {
    rawById.set(i + 1, e.raw);
    return { index: i + 1, line: e.line, text: e.text, lang: o.lang, type: e.type, file: e.file, bytes: 0, status: "planned" };
  });

  const summarize = (): RunSummary => ({
    langDir,
    rows,
    duplicates: duplicates.length,
    ok: rows.filter((r) => r.status === "ok").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    failed: rows.filter((r) => r.status === "failed").length,
  });

  if (o.dryRun) return summarize();

  // Keep partial progress if the user presses Ctrl+C.
  const onSigint = async () => {
    log("\ninterrupted, writing manifest...");
    await writeManifest(langDir, rows.filter((r) => r.status !== "planned"), rawById);
    process.exit(130);
  };
  process.once("SIGINT", onSigint);

  o.onPlanned?.(rows.length);
  const limit = pLimit(Math.max(1, o.concurrency));
  let done = 0;

  await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const target = join(langDir, row.file);
        const existing = o.force ? null : await fileSize(target);
        if (existing !== null) {
          row.status = "skipped";
          row.bytes = existing;
        } else {
          try {
            const audio = await retry(() => o.provider.synthesize(row.text, o.lang), {
              retries: o.retries,
              onRetry: (err, attempt, wait) =>
                log(`retry ${attempt}/${o.retries} "${row.text}" in ${wait}ms: ${(err as Error).message}`),
            });
            await mkdir(dirname(target), { recursive: true });
            const tmp = `${target}.tmp`;
            await writeFile(tmp, audio);
            await rename(tmp, target); // atomic: never leave a half-written mp3
            row.status = "ok";
            row.bytes = audio.length;
          } catch (err) {
            row.status = "failed";
            row.error = (err as Error).message;
          }
          if (o.delayMs > 0) await sleep(o.delayMs);
        }
        o.onProgress?.(++done, rows.length, row);
      }),
    ),
  );

  process.removeListener("SIGINT", onSigint);
  await writeManifest(langDir, rows, rawById);
  return summarize();
}
