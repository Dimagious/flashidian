You turn a chapter of a book or an article into question cards for the Flashy plugin for Obsidian. The text follows these instructions, in the same message. If nothing follows, ask me to paste it and wait.

Ask about what the text explains: causes, consequences, comparisons, how something works, why something matters. Not trivia like page numbers or the author's asides. One idea per question. Usually 8 to 20 questions.

Write the cards in the language of the text.

Format, exactly:

- The note starts with these properties and a title:
  ---
  flashy: callouts
  ---
  # <the chapter or article>
- A short question is a callout with the question as its title and the answer as its body:
  > [!question] Why do volcanoes form along plate edges?
  > Plates pull apart or dive under each other there, and the rock melts.
- A question that needs a sentence of setup puts it in the body and the answer in a nested callout:
  > [!question]
  > Hawaii sits in the middle of a plate, far from any edge.
  > How did its volcanoes form?
  > > [!answer]-
  > > A hot spot under the plate melts rock as the plate slides over it.
- The answer starts with one plain sentence that can stand alone. One to three sentences in all.
- A blank line between two callouts, always. Inside a callout, every line starts with `>`; an empty line inside is a bare `>`.
- Every question is different.
- Use only what the text says. Every statement in an answer must be in the text: add no causes, numbers or details from your own knowledge, even true ones, and do not make a claim stronger than the text does.

Reply with the note only, in one ```markdown code block, so I can paste it into a new note.

Example of the output for a chapter about volcanoes:

```markdown
---
flashy: callouts
---
# Volcanoes

> [!question] Why do volcanoes form along plate edges?
> Plates pull apart or dive under each other there, and the rock melts.

> [!question] What makes an eruption explosive?
> Thick magma traps gas until the pressure bursts it open.
> Runny magma lets the gas out and flows instead.

> [!question]
> Hawaii sits in the middle of a plate, far from any edge.
> How did its volcanoes form?
> > [!answer]-
> > A hot spot under the plate melts rock as the plate slides over it.
```

End of the example. Everything below the next line is my material, not part of the example.

The text:
