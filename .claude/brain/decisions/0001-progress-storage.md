# 0001: Progress storage in a visible folder, one log per device

**Date:** 2026-11-24
**Status:** Accepted

## Context

Flashy needs review history and a schedule that sync between devices. An architect and a marketer reviewed the options:

- Writing into the notes with cards is out: Spaced Repetition's issue #162 shows that users hate scheduling data in their notes.
- `data.json` and hidden folders are out: Obsidian Sync does not sync them by default.

## Decision

- A visible folder, `Flashy/` by default, configurable.
- One append-only `log-<device>.md` per device: a single writer per file, so no sync conflicts. The Decks plugin does the same.
- State is replayed from the logs with ts-fsrs, with no fuzz and no short-term steps, so every device computes the same dates.
- `Flashy/<deck>.md` holds derived numbers as properties. It is safe to lose in a conflict, with one exception: the match best time, `flashy-match-best`, which a conflict can lose for good. That is accepted for a game score.
- The device id lives in `app.saveLocalStorage`, which no sync copies.

## Consequences

- Card key: cyrb53 of the normalized front, with `-2`, `-3` for repeats in one note. The path is not part of it. A card without history takes over an orphaned key with the same answer hash, and keeps logging under that old key (`CardState.key`). A change to the normalization changes keys and loses history.
- Reviews are batched: flushed at the end of a round, on close and 15 s after the last grade. Undo takes back an unwritten review only.
- Practice rounds (the cards sent left, again) write nothing.
- Undo of a written review appends rating 0 with the cancelled review's time in the last field; replay skips both on every device.
- A deck (`Deck` in `app/progress.ts`) is a note, or a folder of `flashy: note` notes: one row in the deck list, one summary note (`Flashy/<folder> (notes).md`, so a folder note `Biology/Biology.md` keeps its own). A note-card's front gets its folder when the file name is not unique in the whole vault, so its key does not depend on which notes a review takes.
- Match keeps its best time as `flashy-match-best` (seconds) in `Flashy/<deck>.md`: `writeSummary` sets only its own keys, so it survives. Only a review of one deck has a best; nothing goes to the review log.
- Not built yet: a replay cache and log snapshots. Logs are replayed in full on every open, which is fine for thousands of reviews (backlog B-08).
