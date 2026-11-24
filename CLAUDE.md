# Flashidian - Claude project notes

> Keep short. Memory lives in `.claude/brain/`.

## What this is

**Flashidian** (plugin name **Flashy**, id `flashidian`) is a flashcard review for Obsidian: a stack of cards, a 3D flip on tap, swipe right to keep, swipe left to repeat, spring physics on release. It reads the Spaced Repetition plugin's multi-line format (paragraph, a line with only `?` or `??`, the answer) so existing decks work unchanged. Fourth plugin after Snipsy, Dashy and Garmy; build, lint, scanner, release and e2e come from `obsidian-plugin-dev-kit` (`opdk`).

Name vs id: `name` must not resemble "Obsidian" (catalog review). So `id` and repo are `flashidian`, `name` is `Flashy`.

## Layout

```
src/core   pure: parse (cards from markdown), session (one round, grades, undo, shuffle). Carries the 90 percent coverage gate.
src/ui     review modal (stack, flip, drag, spring, end-of-round ring), strings (en, ru)
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
- The modal carries `data-ignore-swipe`, otherwise Obsidian mobile opens a sidebar on a horizontal swipe. Whether it also stops the pull-down gesture is not verified on a device yet.
- On the back, a mostly vertical first move releases the pointer so a long answer scrolls (`touch-action: pan-y` on a flipped card).
- Phone fonts are larger: the three labelled buttons hide their icons under `.is-phone`, or "Answer" is clipped at 390 px.
- Obsidian's close button sits under the iPhone status bar in a full-screen modal and the desktop emulation does not show it. Flashy hides it (`.modal-close-button` on desktop, `.modal-header-button` on mobile) and draws its own in `.flashy-top` with the safe-area inset.
- `checkLayout()` returns nothing and throws on problems (overflow, touch targets under 44 px).
- Timers and frames through `activeWindow`, DOM through `activeDocument` (popout windows).
- No em dashes anywhere (code, copy, docs). Commits are authored by the developer only, no Claude trailers.

## Not built yet

FSRS scheduling (`ts-fsrs`, right = Good, left = Again), review state stored in the vault, stats, settings, release.
