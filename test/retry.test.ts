import { describe, expect, it } from "vitest";
import { HttpError, retry } from "../src/utils/retry.ts";

const noSleep = async () => {};

describe("retry", () => {
  it("retries 5xx / 429 and then succeeds", async () => {
    let n = 0;
    const waits: number[] = [];
    const out = await retry(async () => { if (n++ < 2) throw new HttpError(n === 1 ? 429 : 503, "x"); return "ok"; },
      { retries: 3, sleep: noSleep, onRetry: (_e, _a, w) => waits.push(w) });
    expect(out).toBe("ok");
    expect(waits[0]).toBeGreaterThanOrEqual(4000); // 429 -> long backoff
  });
  it("does not retry 4xx other than 429", async () => {
    let n = 0;
    await expect(retry(async () => { n++; throw new HttpError(400, "bad"); }, { retries: 3, sleep: noSleep })).rejects.toThrow("bad");
    expect(n).toBe(1);
  });
  it("gives up after the configured retries", async () => {
    let n = 0;
    await expect(retry(async () => { n++; throw new HttpError(500, "boom"); }, { retries: 2, sleep: noSleep })).rejects.toThrow("boom");
    expect(n).toBe(3);
  });
});
