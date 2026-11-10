import { describe, expect, it } from "vitest";
import { chunkText } from "../src/tts/chunkText.ts";

describe("chunkText", () => {
  it("keeps short text as one chunk", () => {
    expect(chunkText("Hello world.", 200)).toEqual(["Hello world."]);
  });
  it("splits at sentence punctuation first, every chunk within the limit", () => {
    const text = "First sentence here. Second sentence is here too. Third one!";
    const chunks = chunkText(text, 30);
    expect(chunks).toEqual(["First sentence here.", "Second sentence is here too.", "Third one!"]);
  });
  it("falls back to spaces, and hard-splits giant words", () => {
    const chunks = chunkText("aaaa bbbb cccc dddd", 9);
    expect(chunks).toEqual(["aaaa bbbb", "cccc dddd"]);
    expect(chunkText("x".repeat(25), 10)).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
  });
  it("never loses content", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ") + ".";
    const chunks = chunkText(text, 50);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
});
