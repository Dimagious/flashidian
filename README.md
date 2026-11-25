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

- **Question callouts** (`flashy: callouts`): every `> [!question] Front` callout is a card, its body the answer. For a question longer than a title, put the answer in a nested callout:

  ```markdown
  > [!question]
  > The Moon always shows Earth the same face.
  > Why?
  > > [!answer]-
  > > It turns once on its axis in the time it takes to go around Earth.
  ```

  Other callouts in the note stay notes.

A note uses one shape: headings if it has any, otherwise tables, otherwise lists, otherwise question callouts. To pick one, set `flashy: headings`, `flashy: table`, `flashy: list` or `flashy: callouts`.

**A note as one card**: with `flashy: note` the whole note is one card: its name on the front (or the `flashy-prompt` property, for a question), everything below as the answer. Notes like this in one folder make one deck, named after the folder. Two notes with the same name get their folder on the front. A card that two notes share (a glossary and a deck made from it) is reviewed once.

**Paste a deck**: the command *Create a deck from pasted text* takes terms and definitions copied from Quizlet (Export), a spreadsheet, a CSV file or a list, and writes a deck note next to the open note.

**Make cards with an assistant**: the command *Copy a prompt for making cards* (or the rows under *Make cards with an assistant* in the settings) copies a ready prompt for one kind of material: lecture notes into a glossary, foreign words into cards, a chapter into questions, short notes into one card each. Paste it into the assistant you use, paste your material below it, and put the reply into a note. Flashy calls no model and sends nothing anywhere. The prompts live in [`prompts/`](prompts/); [`evals/prompts/`](evals/prompts/) checks them on 24 sample inputs, parsing each reply with Flashy's own parsers.

## Your notes stay as you wrote them

Flashy never writes into the notes with your cards. Progress lives in plain Markdown files in a `Flashy/` folder of your vault (the folder can be changed in settings), so it syncs with Obsidian Sync, iCloud or anything else that syncs notes, and survives reinstalling the plugin:

- `Flashy/log-<device>.md`: each phone or computer appends its reviews to its own log and never touches another's, so two devices cannot produce a sync conflict. Every device replays all logs.
- `Flashy/<deck>.md`: one note per deck (`Flashy/<folder> (notes).md` for a folder of one-card notes) with its numbers as properties (`flashy-total`, `flashy-new`, `flashy-due`, `flashy-learned`, `flashy-learning`), for Bases or any other tool that reads properties.

Moving or renaming a deck keeps its progress: a card is recognised by its text, not by its file. If you edit the front of a card, its history follows the answer.

## Front side and reading aloud

The deck screen chooses what a card shows first: the term, the definition (the term hidden in it, so you recall the term) or a mix. The choice is kept, and the schedule does not change with it.

A speaker on the card, or the S key, reads the side in view. Set `flashy-lang: es` (any language code) in a deck's properties for the voice of its terms; answers are read in Russian when they are in Cyrillic, otherwise in English. Reading uses the voices of your system, offline.

## Quiz

The deck screen also offers a quiz of up to 20 questions: Flashy shows the first plain paragraph of an answer (callouts, lists and tables left out, the term itself hidden as `___`) and four terms from the same review to pick from. A right pick moves on by itself, a wrong one marks the answer and waits. At the end you can retry the ones you missed. Keys 1 to 4 pick, Enter moves on. The quiz does not change the schedule: picking an answer is easier than recalling it.

The reverse quiz turns it around: the term is the question, and the options are four short definitions, each with its own term hidden so it does not give itself away.

## Match

Match deals six cards of the deck as twelve tiles, terms and short definitions shuffled together. Tap a term, then its definition: a right pair leaves the grid, a wrong one flashes. The clock runs until the last pair, and the best time of a deck is kept as `flashy-match-best` in its progress note. Match does not change the schedule.

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
