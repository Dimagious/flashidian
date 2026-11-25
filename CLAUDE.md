# Flashidian - Claude project notes

> Keep short. Memory lives in `.claude/brain/`.

## What this is

**Flashidian** (plugin name **Flashy**, id `flashidian`) is a flashcard review for Obsidian: a stack of cards, a 3D flip on tap, swipe right to keep, swipe left to repeat, spring physics on release. It reads the Spaced Repetition plugin's multi-line format (paragraph, a line with only `?` or `??`, the answer) so existing decks work unchanged. Fourth plugin after Snipsy, Dashy and Garmy; build, lint, scanner, release and e2e come from `obsidian-plugin-dev-kit` (`opdk`).

Name vs id: `name` must not resemble "Obsidian" (catalog review). So `id` and repo are `flashidian`, `name` is `Flashy`.

## Layout

```
src/core   pure: parse (the `?` format), structured (cards from headings, tables, lists, question callouts in notes with a `flashy` property; a whole note as one card), paste (Quizlet, TSV, CSV, list text into pairs), quiz (gist of an answer, masking, multiple choice), session (one round), key (card identity), log (review log format), schedule (FSRS replay, stats, today's queue). Carries the 90 percent coverage gate.
src/app    store (vault I/O: device log, summaries), progress (cards of one review bound to the store), settings (declarative tab)
src/ui     review modal (deck screen, stack, flip, drag, spring, end-of-round ring), decks-block (the `flashy` code block: deck list), prompts (the copy-prompt picker)
src/i18n   one file per language (en, ru, es, de, fr, pt, ja), typed as `Strings` (from en.ts); index.ts picks the language
src/main.ts  commands: review the current note, review a folder (picker, ribbon, folder context menu), copy a prompt
prompts/   the prompts a user copies (bundled into main.js as text, `build.loader` in opdk.config.mjs); src/ui/prompts.ts lists them
evals/     the prompt eval: cases, grader (Flashy's parsers + a judge), runner on `claude -p`; out of lint like e2e, typechecked by tsconfig.evals.json
e2e/       Playwright in real Obsidian: the full review, empty note, phone layout check
```

`core` imports nothing from Obsidian. The modal is covered by e2e, not by the unit gate.

## Commands

```bash
npm run lint && npm run typecheck && npm test && npm run build   # the gates
npm run release:check                                             # everything incl. versions and scorecard
npm run e2e                                                       # needs macOS Obsidian; phone screenshots land in .e2e/
npm run capture                                                   # README films: e2e/capture.spec.ts, then opdk demo -> docs/screens/*.gif
npx opdk release patch --dry-run                                 # cut a release; push all commits first
```

## Maker and checker

Every feature or bug fix that changes code goes through the kit's `maker` (Sonnet) and `checker` (Opus) agents: `.claude/agents/opdk -> node_modules/obsidian-plugin-dev-kit/claude/agents`. Both read this section, and the files it points to, as binding. The main session writes no code: it briefs the maker, passes the reports on, and shows the final verdict and diff. The loop repeats until APPROVE. Without the agents: typos, docs, comments, `.claude/**` files, or when Dmitriy asks for it.

Flashy-specific rules for both agents:

- **Layers.** `src/core` is pure (no `obsidian` imports, no DOM) and carries the 90 percent coverage gate. Vault I/O lives in `src/app`. `src/ui` is covered by e2e, not by the unit gate, so a UI change states what the e2e run must show.
- **Notes with cards are never written to.** Progress goes only to the `Flashy/` folder ([ADR 0001](.claude/brain/decisions/0001-progress-storage.md)). Any write to a card note is REJECT.
- **Card keys and the log format are a contract.** A change to front normalization, `key`, the log line or replay loses history for existing users: it needs a migration and a test that replays an old log. Replay stays deterministic (no FSRS fuzz, no short-term steps).
- **Strings** go into all seven `src/i18n/<lang>.ts` files (see Rules below).
- **Prompts** in `prompts/`: the example must still parse (`src/core/prompts.test.ts`). A new eval variant is Dmitriy's run, not an agent's ([prompts eval](.claude/brain/prompts-eval.md)).
- **Extra gates:** none beyond the kit's five; `npm run typecheck` already covers `tsconfig.evals.json`.
- **Checker lenses.** Trace a grade from the swipe to the device log and back through replay. Trace a note from `build()` to cards: headings, tables, lists, question callouts, `?` blocks, whole notes. Check the card faces against the WebKit traps below. Under "Not verifiable locally": the e2e run (phone layout, the legend on one line per language) and a look on an iPhone for anything visual on the card faces.

## Rules that cost us something

- Card motion goes through CSS variables (`--flashy-x`, `--flashy-y`, `--flashy-r`, `--flashy-keep`, `--flashy-repeat`) set with `setCssProps`.
- No `backdrop-filter` and no pseudo-elements on the card faces: both break `backface-visibility` in WebKit (iOS). e2e runs in Chromium, the iPhone in WebKit: anything visual on the card faces (3D flip, backface, layered children) needs a look on the phone before calling it done.
- The modal carries `data-ignore-swipe`, otherwise Obsidian mobile opens a sidebar on a horizontal swipe. Checked on an iPhone with 0.1.1: swipes no longer open the sidebars.
- On the back, a mostly vertical first move releases the pointer so a long answer scrolls (`touch-action: pan-y` on a flipped card).
- Phone fonts are larger: the three labelled buttons hide their icons under `.is-phone`, or "Answer" is clipped at 390 px.
- Obsidian's close button sits under the iPhone status bar in a full-screen modal and the desktop emulation does not show it. Flashy hides it (`.modal-close-button` on desktop, `.modal-header-button` on mobile) and draws its own in `.flashy-top` with the safe-area inset.
- Obsidian renders a code block twice in a tab: in the reading view and in the hidden editor. e2e locators scope to `.markdown-reading-view`. `DecksBlock` numbers its renders so a redraw that starts while another awaits does not double the rows.
- `ProgressStore.load()` keeps what the session already knows: right after `vault.create` the cache can serve the old log.
- `build()` reads properties from the note's text (`getFrontMatterInfo` + `parseYaml`), not from the metadata cache: a deck list drawn while Obsidian still indexes (startup, a sync) missed `flashy:` decks. Seen as a flaky row count in e2e.
- `checkLayout()` returns nothing and throws on problems (overflow, touch targets under 44 px).
- Quiz terms go through `plainTerm`: strip bold and code marks only. Stripping every `_` turned `stop_reason` into `stopreason` (caught by e2e).
- The quiz hides a card's term in its own answer only when the answer is a sentence (more than three words): a short answer is a name, and "Mexico City" masked as "___ City" read as a bug. A definition-first card masks its term with the same rule.
- Front side (`term`, `definition`, `mixed`) lives in settings and is switched on the deck screen through `ReviewPrefs`. Speech is the Web Speech API (`speechSynthesis`), no network: the term side takes `flashy-lang`, an answer is guessed (Cyrillic means ru, else en). Only the top card shows its speaker: stacked cards are scaled below the 44 px touch target.
- Match's clock redraws every 100 ms, so e2e `settle` watches `.flashy-match`, not the modal.
- Every user-visible string lives in `src/i18n/<lang>.ts`. A new string goes into all seven files; `locales.test.ts` fails on a missing key, an empty text, a lost name (Flashy, Quizlet, `folder:`) or a long text left in English. Default language: Obsidian's (`setLanguage("auto", getLanguage())`), English when unsupported; command names change only after a restart.
- The swipe legend under the card must stay one line in every language: a second line hides behind the card, and `checkLayout` does not see it. The phone test per language measures it.
- No em dashes anywhere (code, copy, docs). Commits are authored by the developer only, no Claude trailers.

## Seed vault: the base of tests and demos

`e2e-vault.pristine/` holds decks anyone recognises, in English, one card format per topic: `Decks/Spanish - Kitchen` (`?` cards), `Biology - The Cell` (headings, `flashy: true`, with a callout, a list and a table inside answers), `Geography - Capitals` (table), `Cooking - Techniques` (list), `Stars - The Night Sky` (question callouts), `Wildlife - Animals/` (a folder of `flashy: note` notes; `demoHistory` skips it). `e2e/data/music-tempo-quizlet.tsv` is a Quizlet export for the paste flow. Parser traps (code, SR comments, repeated fronts, shared answers, a long answer) live in `Edge cases/`, out of the demo decks. No AI or IT terms in the demo decks, and never notes from Dmitriy's vault.

- `src/core/seed.test.ts` keeps it usable: card counts, unique keys, four options per question in both quiz directions, no term leaking into a sentence. Change a deck, update the counts there and in `e2e/review.spec.ts`.
- `e2e/history.ts` `demoHistory(now)` writes a review log dated back from `now` (per five cards: one new, one missed yesterday, three learned). Seed it with `test.use({ seed: { files: { "Flashy/log-demo.md": demoHistory(new Date()) } } })` for a deck in use; a film pairs it with `demo.freezeTime`.

## Decisions, plans, eval

- Progress storage: [ADR 0001](.claude/brain/decisions/0001-progress-storage.md).
- Roadmap and open work: [backlog](.claude/brain/backlog.md).
- Prompts eval (how to run it, what it taught): [prompts-eval](.claude/brain/prompts-eval.md).
