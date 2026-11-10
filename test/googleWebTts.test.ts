import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildRequestBody, decodeAudio, extractBase64, GoogleWebTts, InvalidAudioError, isMp3,
} from "../src/tts/googleWebTts.ts";

const fixture = readFileSync(new URL("./fixtures/welcome_en.response.txt", import.meta.url), "utf8");

describe("buildRequestBody", () => {
  it("matches the f.req captured from the browser", () => {
    const body = buildRequestBody("Welcome", "en");
    expect(decodeURIComponent(body.slice("f.req=".length, -1))).toBe(
      '[[["jQ1olc","[\\"Welcome\\",\\"en\\",null,\\"null\\"]",null,"generic"]]]',
    );
  });
  it("escapes quotes and unicode safely", () => {
    const body = buildRequestBody('Say "hi" & chào', "vi");
    const outer = JSON.parse(decodeURIComponent(body.slice(6, -1)));
    expect(JSON.parse(outer[0][0][1])).toEqual(['Say "hi" & chào', "vi", null, "null"]);
  });
});

describe("response parsing (real captured response)", () => {
  it("extracts base64 that decodes to a valid MP3", () => {
    const b64 = extractBase64(fixture);
    expect(b64.startsWith("//OEx")).toBe(true);
    const mp3 = decodeAudio(b64);
    expect(isMp3(mp3)).toBe(true);
    expect(mp3.length).toBeGreaterThan(5000);
  });
  it("throws on responses with no audio", () => {
    expect(() => extractBase64(")]}'\n\n27\n[[\"e\",4,null,null,10]]")).toThrow(InvalidAudioError);
    expect(() => extractBase64(')]}\'\n\n9\n[["wrb.fr","jQ1olc",null,null,null,[3],"generic"]]')).toThrow(/Empty payload/);
    expect(() => decodeAudio(Buffer.from("not audio").toString("base64"))).toThrow(InvalidAudioError);
  });
});

describe("GoogleWebTts with mocked fetch", () => {
  it("concatenates chunks for long text and raises HttpError on 429", async () => {
    let calls = 0;
    const ok = (async () => { calls++; return new Response(fixture, { status: 200 }); }) as typeof fetch;
    const tts = new GoogleWebTts({ fetchImpl: ok, maxChunkChars: 20 });
    const single = await new GoogleWebTts({ fetchImpl: ok }).synthesize("Welcome", "en");
    calls = 0;
    const multi = await tts.synthesize("One sentence here. Another sentence here.", "en");
    expect(calls).toBe(3);
    expect(multi.length).toBe(single.length * 3);

    const limited = (async () => new Response("", { status: 429, statusText: "Too Many Requests" })) as typeof fetch;
    await expect(new GoogleWebTts({ fetchImpl: limited }).synthesize("x", "en")).rejects.toMatchObject({ status: 429 });
  });
});
