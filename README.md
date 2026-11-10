# glow-translate

Bulk-download Google Translate text-to-speech audio (MP3) for words and sentences listed in a `.txt` file.

> ⚠️ This uses `batchexecute?rpcids=jQ1olc`, the **internal, undocumented** endpoint behind the speaker
> button on translate.google.com. Google may change it or rate-limit it at any time. For stable or
> commercial use, switch to the official Google Cloud Text-to-Speech API. Every TTS call goes through
> `src/tts/TtsProvider.ts`, so a new provider can be plugged in there.

## Setup
```bash
npm install          # Node >= 22
```

## Usage
```bash
npx tsx src/cli.ts input/sample.txt                 # English (default)
npx tsx src/cli.ts input/sample-vi.txt -l vi        # Vietnamese voice
npx tsx src/cli.ts words.txt -l ja -o ./audio -c 3  # Japanese, custom output, 3 parallel
npx tsx src/cli.ts input/sample.txt --dry-run       # show planned filenames only
```

| Option | Default | Meaning |
|---|---|---|
| `-l, --lang <code>` | `en` | TTS language (`en`, `vi`, `ja`, `fr`, …) |
| `-o, --out <dir>` | `./output` | output root |
| `-c, --concurrency <n>` | `2` | parallel requests |
| `--delay <ms>` | `300` | pause after each request, per worker |
| `--retries <n>` | `3` | retries for 429 / 5xx / network errors (429 waits about 5s, 15s, 45s) |
| `--phrase-max-words <n>` | `1` | entries with at most n words count as **words** |
| `--force` | off | re-download files that already exist |
| `--dry-run` | off | no network calls, no files written |

## Input
UTF-8 `.txt` file, one entry per line. Blank lines and lines starting with `#` are ignored. Whitespace
is normalized, and case-insensitive duplicates are skipped and reported. Text longer than 200 chars is
split at punctuation, sent as several requests, and joined into one MP3.

## Output and naming
```
output/<lang>/
  words/<slug>.mp3                      welcome.mp3
  sentences/<slug≤50>__<hash8>.mp3      how-are-you-today__14ce9802.mp3
  manifest.json / manifest.csv          text → file lookup (merged across runs)
  failed.txt                            failed lines from the last run (feed it back as input)
```
- **slug**: lowercase ASCII, accents removed (`Đường phố` → `duong-pho`), punctuation becomes `-`.
- **hash8**: `sha1(lang|lowercased text)`, first 8 hex chars. The same text always gets the same name,
  so re-runs skip existing files (resume). Long sentences with the same prefix never collide.
- No Latin slug (Japanese, Chinese, emoji): the name is just `<hash8>.mp3`. Look up the text in the manifest.
- Two different words with the same slug (`resume` / `résumé`): the second one gets `__<hash8>`.
- There is no `0001_` index prefix on purpose: editing the input would rename every file. The order is kept in the manifest.

## Development
```bash
npm test            # vitest unit tests (parser, naming, chunking, retry, response parsing, pipeline)
npm run typecheck   # tsc --noEmit
```
