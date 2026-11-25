# Flashidian - Claude project notes

> Keep short. Memory lives in `.claude/brain/`.

## What this is

**Flashidian** (plugin name **Flashy**, id `flashidian`) is a flashcard review for Obsidian: a stack of cards, a 3D flip on tap, swipe right to keep, swipe left to repeat, spring physics on release. It reads the Spaced Repetition plugin's multi-line format (paragraph, a line with only `?` or `??`, the answer) so existing decks work unchanged. Fourth plugin after Snipsy, Dashy and Garmy; build, lint, scanner, release and e2e come from `obsidian-plugin-dev-kit` (`opdk`).

Name vs id: `name` must not resemble "Obsidian" (catalog review). So `id` and repo are `flashidian`, `name` is `Flashy`.

## Layout

```
src/core   pure: parse (the `?` format), structured (cards from headings, tables, lists in notes with a `flashy` property), paste (Quizlet, TSV, CSV, list text into pairs), quiz (gist of an answer, masking, multiple choice), session (one round), key (card identity), log (review log format), schedule (FSRS replay, stats, today's queue). Carries the 90 percent coverage gate.
src/app    store (vault I/O: device log, summaries), progress (cards of one review bound to the store), settings (declarative tab)
src/ui     review modal (deck screen, stack, flip, drag, spring, end-of-round ring), decks-block (the `flashy` code block: deck list), strings (en, ru)
src/main.ts  commands: review the current note, review a folder (picker, ribbon, folder context menu)
e2e/       Playwright in real Obsidian: the full review, empty note, phone layout check
```

`core` imports nothing from Obsidian. The modal is covered by e2e, not by the unit gate.

## Commands

```bash
npm run lint && npm run typecheck && npm test && npm run build   # the gates
npm run release:check                                             # everything incl. versions and scorecard
npm run e2e                                                       # needs macOS Obsidian; phone screenshots land in .e2e/
npx opdk release patch --dry-run                                 # cut a release; push all commits first
```

## Rules that cost us something

- Card motion goes through CSS variables (`--flashy-x`, `--flashy-y`, `--flashy-r`, `--flashy-keep`, `--flashy-repeat`) set with `setCssProps`; the scanner rejects `el.style.*` assignments.
- No `backdrop-filter` and no pseudo-elements on the card faces: both break `backface-visibility` in WebKit (iOS).
- The modal carries `data-ignore-swipe`, otherwise Obsidian mobile opens a sidebar on a horizontal swipe. Checked on an iPhone with 0.1.1: swipes no longer open the sidebars.
- On the back, a mostly vertical first move releases the pointer so a long answer scrolls (`touch-action: pan-y` on a flipped card).
- Phone fonts are larger: the three labelled buttons hide their icons under `.is-phone`, or "Answer" is clipped at 390 px.
- Obsidian's close button sits under the iPhone status bar in a full-screen modal and the desktop emulation does not show it. Flashy hides it (`.modal-close-button` on desktop, `.modal-header-button` on mobile) and draws its own in `.flashy-top` with the safe-area inset.
- Obsidian renders a code block twice in a tab: in the reading view and in the hidden editor. e2e locators scope to `.markdown-reading-view`. `DecksBlock` numbers its renders so a redraw that starts while another awaits does not double the rows.
- `ProgressStore.load()` keeps what the session already knows: right after `vault.create` the cache can serve the old log.
- `checkLayout()` returns nothing and throws on problems (overflow, touch targets under 44 px).
- Timers and frames through `activeWindow`, DOM through `activeDocument` (popout windows).
- No em dashes anywhere (code, copy, docs). Commits are authored by the developer only, no Claude trailers.

## Progress storage (ADR, 2026-11-24)

Decided after an architect and a marketer reviewed the options: notes with cards are never written to (SR's issue #162: users hate scheduling data in notes); `data.json` and hidden folders are out because Obsidian Sync does not sync them by default. So: a visible folder (`Flashy/`, configurable), one append-only `log-<device>.md` per device (single writer, no sync conflicts, Decks does the same), state replayed with ts-fsrs (no fuzz, no short-term steps, so every device computes the same dates), and `Flashy/<deck>.md` with derived numbers as properties (safe to lose in a conflict; the one exception is the match best time, `flashy-match-best`, which a conflict can lose for good, accepted as a game score). Device id in `app.saveLocalStorage`, which no sync copies.

- Card key: cyrb53 of the normalized front, `-2`, `-3` for repeats in one note; the path is not part of it. A card without history takes over an orphaned key with the same answer hash, and keeps logging under that old key (`CardState.key`).
- Reviews are batched: flushed at the end of a round, on close and 15 s after the last grade. Undo takes back an unwritten review only.
- Practice rounds (the cards sent left, again) write nothing.
- Undo of a written review appends rating 0 with the cancelled review's time in the last field; replay skips both on every device.
- Quiz terms go through `plainTerm`: strip bold and code marks only. Stripping every `_` turned `stop_reason` into `stopreason` (caught by e2e).
- No regex lookbehind anywhere: iOS before 16.4 cannot parse it, and `obsidianmd/regex-lookbehind` fails the lint.

- The quiz hides a card's term in its own answer only when the answer is a sentence (more than three words): a short answer is a name, and "Mexico City" masked as "___ City" read as a bug.

- Match keeps its best time as `flashy-match-best` (seconds) in `Flashy/<deck>.md`: `writeSummary` sets only its own keys, so it survives. Only a one-note review has a best; nothing goes to the review log. Its clock redraws every 100 ms, so e2e `settle` watches `.flashy-match`, not the modal.
- Front side (`term`, `definition`, `mixed`) lives in settings and is switched on the deck screen through `ReviewPrefs`; a definition-first card masks its term with the same rule as the quiz. Speech is the Web Speech API (`speechSynthesis`), no network: the term side takes `flashy-lang`, an answer is guessed (Cyrillic means ru, else en). Only the top card shows its speaker: stacked cards are scaled below the 44 px touch target.

## Seed vault: the base of tests and demos

`e2e-vault.pristine/` holds decks anyone recognises, in English, one card format per topic: `Decks/Spanish - Kitchen` (`?` cards), `Biology - The Cell` (headings, `flashy: true`, with a callout, a list and a table inside answers), `Geography - Capitals` (table), `Cooking - Techniques` (list). `e2e/data/music-tempo-quizlet.tsv` is a Quizlet export for the paste flow. Parser traps (code, SR comments, repeated fronts, shared answers, a long answer) live in `Edge cases/`, out of the demo decks. No AI or IT terms in the demo decks, and never notes from Dmitriy's vault.

- `src/core/seed.test.ts` keeps it usable: card counts, unique keys, four options per question in both quiz directions, no term leaking into a sentence. Change a deck, update the counts there and in `e2e/review.spec.ts`.
- `e2e/history.ts` `demoHistory(now)` writes a review log dated back from `now` (per five cards: one new, one missed yesterday, three learned). Seed it with `test.use({ seed: { files: { "Flashy/log-demo.md": demoHistory(new Date()) } } })` for a deck in use; a film pairs it with `demo.freezeTime`.

## Roadmap (agreed 2026-11-25, from a look at Quizlet's set page)

Done: mode tiles, front side, read aloud (0.7.x); match game (`src/core/match.ts`, fourth tile, 2x2 mode grid). Still open for match: the README GIF and a look on the iPhone. Next, in order:

2. Hint before the flip: first letter and length of the answer (`s _ _ _ _`).
3. Stars without touching notes: a star is a log entry; plus an automatic "Difficult" filter (cards sent left twice or more).
4. Keyboard help on `?` in a round.
5. Later: type the answer with fuzzy matching for short answers; autoplay with speech; catalog prep (`opdk demo` films on the seed vault with `demoHistory`, listing stills); replay cache for big logs.

Not taken from Quizlet: print, embed, merge, copy (Obsidian does these), calendar (the deck block does it), study with friends and live games (need a server), ads.

Testing note: e2e runs in Chromium (Obsidian desktop); the iPhone runs WebKit. Anything visual on the card faces (3D flip, backface, layered children) needs a look on the phone before calling it done.

## Not built yet

Replay cache and log snapshots (logs are replayed in full on every open; fine for thousands of reviews).
