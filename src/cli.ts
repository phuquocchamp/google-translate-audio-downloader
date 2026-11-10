#!/usr/bin/env -S npx tsx
import { Command, InvalidArgumentError } from "commander";
import cliProgress from "cli-progress";
import { DEFAULTS } from "./config.ts";
import { run } from "./pipeline/run.ts";
import { GoogleWebTts } from "./tts/googleWebTts.ts";

const int = (name: string, min = 0) => (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new InvalidArgumentError(`${name} must be an integer >= ${min}`);
  return n;
};

const program = new Command()
  .name("glow-tts")
  .description("Download Google Translate TTS audio (MP3) for every word/sentence in a .txt file")
  .argument("<input>", "UTF-8 .txt file, one word or sentence per line (# = comment)")
  .option("-l, --lang <code>", "TTS language code (en, vi, ja, fr...)", DEFAULTS.lang)
  .option("-o, --out <dir>", "output root folder", DEFAULTS.outDir)
  .option("-c, --concurrency <n>", "parallel requests", int("concurrency", 1), DEFAULTS.concurrency)
  .option("--delay <ms>", "pause after each request per worker", int("delay"), DEFAULTS.delayMs)
  .option("--retries <n>", "retries per entry", int("retries"), DEFAULTS.retries)
  .option("--phrase-max-words <n>", "entries with <= n words are 'word'", int("phrase-max-words", 1), DEFAULTS.phraseMaxWords)
  .option("--force", "re-download even if the file already exists", false)
  .option("--dry-run", "print planned filenames only, no network calls", false)
  .action(async (input: string, opts) => {
    const lang = String(opts.lang).trim();
    if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang)) {
      program.error(`invalid --lang "${lang}"`);
    }
    const bar = new cliProgress.SingleBar(
      { format: "{bar} {value}/{total} | {status} {text}", hideCursor: true, clearOnComplete: true },
      cliProgress.Presets.shades_classic,
    );
    const isTty = process.stdout.isTTY && !opts.dryRun;

    const summary = await run({
      input,
      lang,
      outDir: opts.out,
      concurrency: opts.concurrency,
      delayMs: opts.delay,
      retries: opts.retries,
      force: opts.force,
      dryRun: opts.dryRun,
      phraseMaxWords: opts.phraseMaxWords,
      provider: new GoogleWebTts(),
      log: (m) => (isTty ? process.stderr.write(`\n${m}\n`) : console.error(m)),
      onPlanned: (total) => isTty && bar.start(total, 0, { status: "", text: "" }),
      onProgress: (done, total, row) => {
        if (isTty) bar.update(done, { status: row.status, text: row.text.slice(0, 40) });
        else console.log(`[${done}/${total}] ${row.status.padEnd(7)} ${row.file}${row.error ? `  (${row.error})` : ""}`);
      },
    });
    if (isTty) bar.stop();

    if (opts.dryRun) {
      console.log(`Dry run: ${summary.rows.length} entries -> ${summary.langDir}/`);
      for (const r of summary.rows) console.log(`  ${r.type.padEnd(8)} ${r.file.padEnd(60)} <- ${r.text}`);
    } else {
      console.log(
        `Done: ${summary.ok} downloaded, ${summary.skipped} skipped (already exist), ${summary.failed} failed, ` +
          `${summary.duplicates} duplicates ignored.\nOutput: ${summary.langDir}/ (manifest.json, manifest.csv)`,
      );
      if (summary.failed) {
        console.log(`Failed lines saved to ${summary.langDir}/failed.txt, re-run with that file as input.`);
        process.exitCode = 1;
      }
    }
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
