# Google Translate Audio Downloader

Bulk-download Google Translate text-to-speech audio (MP3) for words and sentences listed in a `.txt` file.
One line in, one `.mp3` out, with predictable filenames and a manifest that maps each text to its file.

> ⚠️ This uses `batchexecute?rpcids=jQ1olc`, the **internal, undocumented** endpoint behind the speaker
> button on translate.google.com. Google may change it or rate-limit it at any time. For stable or
> commercial use, switch to the official Google Cloud Text-to-Speech API. Every TTS call goes through
> `src/tts/TtsProvider.ts`, so a new provider can be plugged in there.

## Setup
Requires Node.js 22 or newer.
```bash
git clone https://github.com/phuquocchamp/google-translate-audio-downloader.git
cd google-translate-audio-downloader
npm install
```

## Usage
```bash
npx tsx src/cli.ts input/sample.txt                 # English (default)
npx tsx src/cli.ts input/sample-vi.txt -l vi        # Vietnamese voice
npx tsx src/cli.ts words.txt -l ja -o ./audio -c 3  # Japanese, custom output, 3 parallel
npx tsx src/cli.ts input/sample.txt --dry-run       # show planned filenames only
npx tsx src/cli.ts output/en/failed.txt             # retry the lines that failed last time
```

`npm start -- input/sample.txt -l en` works too.

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

Example input file, `input/sample.txt`:
```text
# Sample input: one word or sentence per line. Lines starting with # are ignored.
Welcome
apple
Apple
ice cream
How are you today?
I'd like a cup of coffee, please.
```

## Example: input and output
These results come from a real run on `input/sample.txt` above.

**Command and terminal output**
```console
$ npx tsx src/cli.ts input/sample.txt -l en
duplicate skipped: line 4 "Apple" (same as line 3)
[1/5] ok      words/apple.mp3
[2/5] ok      words/welcome.mp3
[3/5] ok      sentences/ice-cream__9cf9f6c1.mp3
[4/5] ok      sentences/how-are-you-today__14ce9802.mp3
[5/5] ok      sentences/id-like-a-cup-of-coffee-please__f7616a33.mp3
Done: 5 downloaded, 0 skipped (already exist), 0 failed, 1 duplicates ignored.
Output: output/en/ (manifest.json, manifest.csv)
```

**Files created**
```text
output/en/
├── manifest.csv
├── manifest.json
├── words/
│   ├── apple.mp3                                       6.6 KB  0.84 s
│   └── welcome.mp3                                     7.3 KB  0.94 s
└── sentences/
    ├── how-are-you-today__14ce9802.mp3                10.3 KB  1.32 s
    ├── ice-cream__9cf9f6c1.mp3                         8.1 KB  1.03 s
    └── id-like-a-cup-of-coffee-please__f7616a33.mp3   20.1 KB  2.57 s
```

**`output/en/manifest.json`** (first entry; there is one entry per file)
```json
{
  "index": 1,
  "line": 2,
  "text": "Welcome",
  "lang": "en",
  "type": "word",
  "file": "words/welcome.mp3",
  "bytes": 7488,
  "status": "ok"
}
```
`manifest.csv` has the same columns: `index,line,text,lang,type,file,bytes,status,error`.

**Running it again** downloads nothing, because the files already exist:
```console
$ npx tsx src/cli.ts input/sample.txt -l en
[1/5] skipped words/welcome.mp3
...
Done: 0 downloaded, 5 skipped (already exist), 0 failed, 1 duplicates ignored.
```

Vietnamese words such as `Xin chào` contain a space, so they go into `sentences/`. Add
`--phrase-max-words 2` to put them in `words/`.

### Listen to the sample audio
These are the real files produced by the runs above, copied into [`docs/audio/`](docs/audio).
GitHub can't play audio inside a README, so click **▶ Play** to open a file. GitHub's file
page plays it or offers a download.

| Lang | Input text | Output file | Length | Audio |
|---|---|---|---|---|
| en | `Welcome` | `words/welcome.mp3` | 0.94 s | [▶ Play](docs/audio/en/words/welcome.mp3) |
| en | `apple` | `words/apple.mp3` | 0.84 s | [▶ Play](docs/audio/en/words/apple.mp3) |
| en | `ice cream` | `sentences/ice-cream__9cf9f6c1.mp3` | 1.03 s | [▶ Play](docs/audio/en/sentences/ice-cream__9cf9f6c1.mp3) |
| en | `How are you today?` | `sentences/how-are-you-today__14ce9802.mp3` | 1.32 s | [▶ Play](docs/audio/en/sentences/how-are-you-today__14ce9802.mp3) |
| en | `I'd like a cup of coffee, please.` | `sentences/id-like-a-cup-of-coffee-please__f7616a33.mp3` | 2.57 s | [▶ Play](docs/audio/en/sentences/id-like-a-cup-of-coffee-please__f7616a33.mp3) |
| en | 300-character paragraph ([`input/long.txt`](input/long.txt)), sent as 2 requests | `sentences/learning-a-new-language-takes-patience-and-daily__870b3b5f.mp3` | 19.97 s | [▶ Play](docs/audio/en/sentences/learning-a-new-language-takes-patience-and-daily__870b3b5f.mp3) |
| vi | `Xin chào` | `sentences/xin-chao__6ccc685a.mp3` | 1.13 s | [▶ Play](docs/audio/vi/sentences/xin-chao__6ccc685a.mp3) |
| vi | `Cảm ơn` | `sentences/cam-on__5f91b4d5.mp3` | 0.98 s | [▶ Play](docs/audio/vi/sentences/cam-on__5f91b4d5.mp3) |
| vi | `Bạn khỏe không?` | `sentences/ban-khoe-khong__b40c4830.mp3` | 1.37 s | [▶ Play](docs/audio/vi/sentences/ban-khoe-khong__b40c4830.mp3) |
| vi | `Đường phố này rất đẹp.` | `sentences/duong-pho-nay-rat-dep__9fb8f53c.mp3` | 1.97 s | [▶ Play](docs/audio/vi/sentences/duong-pho-nay-rat-dep__9fb8f53c.mp3) |
| ja | `こんにちは` | `words/763ee191.mp3` | 1.27 s | [▶ Play](docs/audio/ja/words/763ee191.mp3) |
| ja | `お元気 ですか` | `sentences/9171eca6.mp3` | 1.49 s | [▶ Play](docs/audio/ja/sentences/9171eca6.mp3) |

All files are MP3, 64 kbps, 24 kHz, mono. The input files for the other languages are
[`input/sample-vi.txt`](input/sample-vi.txt) and [`input/sample-ja.txt`](input/sample-ja.txt).

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

## Project structure
```
src/
  cli.ts                 command-line options
  input/parseInput.ts    .txt → entries (trim, skip comments, dedupe, word/sentence)
  naming/fileName.ts     entry → safe, stable filename
  tts/googleWebTts.ts    calls the jQ1olc endpoint, decodes base64 → MP3
  tts/chunkText.ts       splits text over 200 chars
  pipeline/run.ts        concurrency, retries, resume, atomic writes
  pipeline/manifest.ts   manifest.json / manifest.csv / failed.txt
test/                    vitest suite + one real captured response fixture
```

## Development
```bash
npm test            # vitest unit tests (parser, naming, chunking, retry, response parsing, pipeline)
npm run typecheck   # tsc --noEmit
```
