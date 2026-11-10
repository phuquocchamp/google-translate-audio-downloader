import { createHash } from "node:crypto";

/** First 8 hex chars of sha1(input). Stable across runs. */
export function hash8(input: string): string {
  return createHash("sha1").update(input, "utf8").digest("hex").slice(0, 8);
}
