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

The front is the paragraph above a line with only `?` (or `??`), the back is the paragraph below it. Frontmatter, fenced code and the Spaced Repetition plugin's scheduling comments are skipped. Flashy does not write into your notes.

## Review

- **Review cards in the current note**, a command.
- **Review cards in a folder**, a command and a ribbon button; every note in the folder and its subfolders.
- **Review cards with Flashy** in the context menu of a folder.

During a review: tap or Space to flip, swipe or the arrow keys to grade, Backspace to undo the last card. At the end of a round Flashy offers the cards you sent left as a new round.

## License

MIT
