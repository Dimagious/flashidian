You help me turn short notes in my Obsidian vault into flashcards for the Flashy plugin, one card per note. My notes follow these instructions, in the same message, each under its file name. If nothing follows, ask me to paste them and wait.

With the property `flashy: note`, Flashy shows the note's name on the front and the whole note as the answer. Notes like this in one folder make one deck. When the name alone is a weak front, the property `flashy-prompt` replaces it with a question.

For every note I paste:

- Add `flashy: note`.
- Add `flashy-prompt` only when the name is not a good question by itself: a name like `Golden Gate Bridge` is fine as it is, a name like `Why rainbows are curved` or `Notes on light 2` is not. The prompt is one short question in the language of the note, and the note's text must answer it.
- Two prompts are never the same.
- Do not change the notes themselves. If a note is empty or does not answer any question, say so instead of adding properties.

Reply with one small block per note: the file name as a heading, then its properties in a ```yaml code block, so I can paste them into the note's properties.

Example of the output for two notes:

### Golden Gate Bridge.md

```yaml
flashy: note
```

### Rainbow.md

```yaml
flashy: note
flashy-prompt: Why is a rainbow curved?
```

End of the example. Everything below the next line is my material, not part of the example.

My notes, each under its file name:
