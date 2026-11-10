import { DEFAULTS } from "../config.ts";
import { HttpError } from "../utils/retry.ts";
import { chunkText } from "./chunkText.ts";
import type { TtsProvider } from "./TtsProvider.ts";

const RPC_ID = "jQ1olc";
const ENDPOINT =
  "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute" +
  `?rpcids=${RPC_ID}&source-path=%2F&hl=en&rt=c`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export class InvalidAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAudioError";
  }
}

export function buildRequestBody(text: string, lang: string): string {
  const inner = JSON.stringify([text, lang, null, "null"]);
  const freq = JSON.stringify([[[RPC_ID, inner, null, "generic"]]]);
  return "f.req=" + encodeURIComponent(freq) + "&";
}

/**
 * Parse a batchexecute (rt=c) response and return the base64 audio string.
 * Format: ")]}'\n\n<len>\n<json>\n<len>\n<json>..."; we scan every line that is a
 * JSON array and look for ["wrb.fr","jQ1olc","<payload json>",...].
 */
export function extractBase64(responseText: string): string {
  const body = responseText.replace(/^\)\]\}'/, "");
  for (const line of body.split("\n")) {
    const s = line.trim();
    if (!s.startsWith("[")) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(s); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    for (const item of parsed) {
      if (Array.isArray(item) && item[0] === "wrb.fr" && item[1] === RPC_ID) {
        if (typeof item[2] !== "string") {
          throw new InvalidAudioError(`Empty payload from ${RPC_ID} (unsupported language or text?)`);
        }
        const payload = JSON.parse(item[2]);
        const b64 = Array.isArray(payload) ? payload[0] : undefined;
        if (typeof b64 !== "string" || !b64) throw new InvalidAudioError("No audio string in payload");
        return b64;
      }
    }
  }
  throw new InvalidAudioError(`No ${RPC_ID} result found in response`);
}

export function isMp3(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf.subarray(0, 3).toString("latin1") === "ID3") return true;
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0; // MPEG frame sync
}

export function decodeAudio(b64: string): Buffer {
  const buf = Buffer.from(b64, "base64");
  if (!isMp3(buf)) throw new InvalidAudioError("Decoded data is not an MP3");
  return buf;
}

export class GoogleWebTts implements TtsProvider {
  readonly name = "google-web-jQ1olc";
  constructor(
    private readonly opts: { maxChunkChars?: number; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
  ) {}

  async synthesizeChunk(text: string, lang: string): Promise<Buffer> {
    const res = await (this.opts.fetchImpl ?? fetch)(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": USER_AGENT,
        Origin: "https://translate.google.com",
        Referer: "https://translate.google.com/",
      },
      body: buildRequestBody(text, lang),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 20_000),
    });
    if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} ${res.statusText}`);
    return decodeAudio(extractBase64(await res.text()));
  }

  async synthesize(text: string, lang: string): Promise<Buffer> {
    const chunks = chunkText(text, this.opts.maxChunkChars ?? DEFAULTS.maxChunkChars);
    const parts: Buffer[] = [];
    for (const c of chunks) parts.push(await this.synthesizeChunk(c, lang));
    return Buffer.concat(parts);
  }
}
