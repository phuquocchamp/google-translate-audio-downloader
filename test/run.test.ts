import { mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/pipeline/run.ts";
import type { TtsProvider } from "../src/tts/TtsProvider.ts";
import { HttpError } from "../src/utils/retry.ts";

const MP3 = Buffer.from([0xff, 0xf3, 0x84, 0xc4, 1, 2, 3]);

function fakeProvider(failOn: string[] = []): TtsProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: "fake", calls,
    async synthesize(text) { calls.push(text); if (failOn.includes(text)) throw new HttpError(400, "rejected"); return MP3; },
  };
}

async function setup(content: string) {
  const dir = await mkdtemp(join(tmpdir(), "glow-tts-"));
  const input = join(dir, "in.txt");
  await writeFile(input, content);
  return { dir, input, out: join(dir, "out") };
}

const base = { lang: "en", concurrency: 2, delayMs: 0, retries: 0, force: false, dryRun: false, phraseMaxWords: 1 };

describe("run pipeline", () => {
  it("writes mp3s + manifest, then skips everything on re-run", async () => {
    const { input, out } = await setup("Welcome\nHow are you?\nwelcome\n");
    const p1 = fakeProvider();
    const s1 = await run({ ...base, input, outDir: out, provider: p1 });
    expect(s1).toMatchObject({ ok: 2, skipped: 0, failed: 0, duplicates: 1 });
    expect((await stat(join(out, "en/words/welcome.mp3"))).size).toBe(MP3.length);

    const manifest = JSON.parse(await readFile(join(out, "en/manifest.json"), "utf8"));
    expect(manifest.map((r: any) => [r.index, r.type, r.status])).toEqual([[1, "word", "ok"], [2, "sentence", "ok"]]);
    expect(await readFile(join(out, "en/manifest.csv"), "utf8")).toContain("How are you?");

    const p2 = fakeProvider();
    const s2 = await run({ ...base, input, outDir: out, provider: p2 });
    expect(s2).toMatchObject({ ok: 0, skipped: 2 });
    expect(p2.calls).toEqual([]);

    const p3 = fakeProvider();
    await run({ ...base, input, outDir: out, provider: p3, force: true });
    expect(p3.calls.length).toBe(2);
  });

  it("records failures in manifest and failed.txt without stopping the batch", async () => {
    const { input, out } = await setup("good\nbad\n");
    const s = await run({ ...base, input, outDir: out, provider: fakeProvider(["bad"]) });
    expect(s).toMatchObject({ ok: 1, failed: 1 });
    expect(await readFile(join(out, "en/failed.txt"), "utf8")).toBe("bad\n");
  });

  it("merges the manifest across runs of different input files", async () => {
    const a = await setup("alpha\nbeta\n");
    await run({ ...base, input: a.input, outDir: a.out, provider: fakeProvider() });
    const bInput = join(a.dir, "b.txt");
    await writeFile(bInput, "gamma\nalpha\n");
    await run({ ...base, input: bInput, outDir: a.out, provider: fakeProvider() });
    const manifest = JSON.parse(await readFile(join(a.out, "en/manifest.json"), "utf8"));
    expect(manifest.map((r: any) => [r.index, r.text, r.status])).toEqual([
      [1, "gamma", "ok"], [2, "alpha", "skipped"], [3, "beta", "ok"],
    ]);
  });

  it("dry run makes no calls and writes nothing", async () => {
    const { input, out } = await setup("hello\n");
    const p = fakeProvider();
    const s = await run({ ...base, input, outDir: out, provider: p, dryRun: true });
    expect(s.rows[0].file).toBe("words/hello.mp3");
    expect(p.calls).toEqual([]);
    await expect(stat(out)).rejects.toThrow();
  });
});
