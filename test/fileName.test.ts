import { describe, expect, it } from "vitest";
import { parseInputText } from "../src/input/parseInput.ts";
import { entryHash, nameEntries, slug, truncateSlug } from "../src/naming/fileName.ts";

const names = (txt: string, lang = "en") => nameEntries(parseInputText(txt).entries, lang).map((e) => e.file);

describe("slug", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(slug("Welcome")).toBe("welcome");
    expect(slug("How are you today?")).toBe("how-are-you-today");
    expect(slug("I'd like a cup of coffee, please.")).toBe("id-like-a-cup-of-coffee-please");
    expect(slug("Xin chào, bạn khỏe không?")).toBe("xin-chao-ban-khoe-khong");
    expect(slug("Đường phố")).toBe("duong-pho");
    expect(slug("résumé")).toBe("resume");
  });
  it("returns empty for scripts with no latin transliteration", () => {
    expect(slug("こんにちは")).toBe("");
    expect(slug("🎉🎉")).toBe("");
    expect(slug("?!")).toBe("");
  });
});

describe("truncateSlug", () => {
  it("cuts on a word boundary", () => {
    expect(truncateSlug("the-quick-brown-fox", 12)).toBe("the-quick");
    expect(truncateSlug("short", 50)).toBe("short");
    expect(truncateSlug("supercalifragilistic", 5)).toBe("super");
  });
});

describe("nameEntries", () => {
  it("names words by slug, sentences by slug__hash8", () => {
    const h = entryHash("en", "How are you today?");
    expect(names("Welcome\nHow are you today?")).toEqual(["words/welcome.mp3", `sentences/how-are-you-today__${h}.mp3`]);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic across runs and depends on language", () => {
    expect(names("How are you today?")).toEqual(names("How are you today?"));
    expect(names("hello", "en")).toEqual(["words/hello.mp3"]);
    expect(entryHash("en", "hello")).not.toBe(entryHash("fr", "hello"));
  });

  it("gives long sentences with the same 50-char prefix different names", () => {
    const a = "This is a very long sentence that keeps going and going until the end A";
    const b = "This is a very long sentence that keeps going and going until the end B";
    const [fa, fb] = names(`${a}\n${b}`);
    expect(fa).not.toBe(fb);
    const stem = fa.split("/")[1].split("__")[0];
    expect(stem.length).toBeLessThanOrEqual(50);
  });

  it("adds a hash suffix when two different words share a slug", () => {
    const [first, second] = names("resume\nrésumé");
    expect(first).toBe("words/resume.mp3");
    expect(second).toBe(`words/resume__${entryHash("en", "résumé")}.mp3`);
  });

  it("falls back to hash-only names for CJK", () => {
    const [w, s] = names("こんにちは\nお元気 ですか", "ja");
    expect(w).toBe(`words/${entryHash("ja", "こんにちは")}.mp3`);
    expect(s).toBe(`sentences/${entryHash("ja", "お元気 ですか")}.mp3`);
  });

  it("only produces filesystem-safe names", () => {
    for (const f of names('a/b\\c:d*e?f"g<h>i|j\nCON\n..')) expect(f).toMatch(/^(words|sentences)\/[a-z0-9_-]+\.mp3$/);
  });
});
