export interface TtsProvider {
  readonly name: string;
  /** Return MP3 bytes for the given text and language code (e.g. "en", "vi"). */
  synthesize(text: string, lang: string): Promise<Buffer>;
}
