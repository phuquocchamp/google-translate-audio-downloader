import { describe, expect, it } from "vitest";
import { classify, parseInputText } from "../src/input/parseInput.ts";

describe("parseInputText", () => {
  it("skips blanks and # comments, trims and collapses whitespace", () => {
    const { entries } = parseInputText("# header\n\n  Welcome  \n\tice    cream\n\r\n");
    expect(entries.map((e) => e.text)).toEqual(["Welcome", "ice cream"]);
    expect(entries.map((e) => e.line)).toEqual([3, 4]);
  });

  it("dedupes case-insensitively and reports duplicates", () => {
    const { entries, duplicates } = parseInputText("Apple\napple\nAPPLE\nbanana");
    expect(entries.map((e) => e.text)).toEqual(["Apple", "banana"]);
    expect(duplicates).toEqual([
      { line: 2, text: "apple", firstLine: 1 },
      { line: 3, text: "APPLE", firstLine: 1 },
    ]);
  });

  it("handles CRLF and a UTF-8 BOM", () => {
    const { entries } = parseInputText("﻿Xin chào\r\nCảm ơn\r\n");
    expect(entries.map((e) => e.text)).toEqual(["Xin chào", "Cảm ơn"]);
  });

  it("classifies single tokens as words, anything with spaces as sentences", () => {
    expect(classify("Welcome")).toBe("word");
    expect(classify("I'd")).toBe("word");
    expect(classify("ice cream")).toBe("sentence");
    expect(classify("ice cream", 2)).toBe("word");
    expect(classify("How are you?")).toBe("sentence");
  });
});
