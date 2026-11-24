# Flashy

Flashcards for [Obsidian](https://obsidian.md/), made for reviewing on a phone. Tap a card to flip it, swipe right when you know it, swipe left to see it again.

Status: early prototype, not in the community directory yet.

## Cards

Flashy reads the multi-line format of the Spaced Repetition plugin, so decks you already have work as they are:

```markdown
**Agentic Loop**
?
A control flow where Claude repeats input, action and observation until the task is done.
```

The front is the paragraph above a line with only `?` (or `??`), the back is the paragraph below it. Frontmatter, fenced code and the Spaced Repetition plugin's scheduling comments are skipped.

## Cards from notes you already have

Add `flashy: true` to the properties of a note and Flashy finds the cards in it, no special syntax:

- **Headings**: every `## Term` is a card, the text under it (callouts, tables and code included) is the answer. A glossary becomes a deck as it is.
- **Tables**: every row of a table with two or more columns; the first cell is the front.
- **Lists**: top-level items like `term - definition`, `term: definition` or `**term** definition`.

A note uses one shape: headings if it has any, otherwise tables, otherwise lists. To pick one, set `flashy: headings`, `flashy: table` or `flashy: list`. A card that two notes share (a glossary and a deck made from it) is reviewed once.

**Paste a deck**: the command *Create a deck from pasted text* takes terms and definitions copied from Quizlet (Export), a spreadsheet, a CSV file or a list, and writes a deck note next to the open note.

## Your notes stay as you wrote them

Flashy never writes into the notes with your cards. Progress lives in plain Markdown files in a `Flashy/` folder of your vault (the folder can be changed in settings), so it syncs with Obsidian Sync, iCloud or anything else that syncs notes, and survives reinstalling the plugin:

- `Flashy/log-<device>.md`: each phone or computer appends its reviews to its own log and never touches another's, so two devices cannot produce a sync conflict. Every device replays all logs.
- `Flashy/<deck>.md`: one note per deck with its numbers as properties (`flashy-total`, `flashy-new`, `flashy-due`, `flashy-learned`, `flashy-learning`), for Bases or any other tool that reads properties.

Moving or renaming a deck keeps its progress: a card is recognised by its text, not by its file. If you edit the front of a card, its history follows the answer.

## Scheduling

Flashy schedules with [FSRS](https://github.com/open-spaced-repetition/ts-fsrs). Swipe right (got it) and a new card comes back in a few days, then in weeks; swipe left (again) and it comes back tomorrow. Each deck opens on a screen with today's cards, new cards and learned cards. New cards are introduced at 20 a day across all decks, a number you can change in settings.

## Review

A deck list in any note, one tap to start:

````markdown
```flashy
folder: Study/Biology
```
````

Every note with cards in that folder and its subfolders becomes a row with today's count and a learned bar, plus a row for all of them together. The list redraws when the review closes.

Or start from the command palette and the file explorer:

- **Review cards in the current note**, a command.
- **Review cards in a folder**, a command and a ribbon button; every note in the folder and its subfolders.
- **Review cards with Flashy** in the context menu of a folder.

During a review: tap or Space to flip, swipe or the arrow keys to grade, Backspace to undo the last card (also after it was written to the log). At the end of a round Flashy offers the cards you sent left as a practice round, which does not change the schedule.

## License

MIT
