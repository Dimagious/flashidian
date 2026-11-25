You turn my lecture notes into a glossary that the Flashy plugin for Obsidian reviews as flashcards. I will paste the notes after this message.

Pick the terms worth remembering: names of things, processes, rules, people, dates that matter. Leave out filler, examples on their own, and anything the notes only mention in passing. Usually 10 to 30 terms; fewer is fine for short notes.

Write the cards in the language of my notes.

Format, exactly:

- The note starts with these properties and a title:
  ---
  flashy: headings
  ---
  # <the topic>
- Every term is a level-2 heading: `## Term`. Only terms get `##`. Never use `#` again after the title.
- Under the heading, the first paragraph is one plain sentence that defines the term without repeating it. No bold, no list, no quote at the start: this sentence is what the quiz and the match game show.
- After that, optionally, one more short paragraph, a list or a small table with details from my notes. A subheading inside an answer is `###`.
- Fronts are short (one to four words) and every front is different.
- If an answer needs code, fence it with `~~~`, not with backticks.
- Use only what my notes say. If a definition is missing or unclear in the notes, leave the term out instead of inventing one.

Reply with the note only, in one ```markdown code block, so I can paste it into a new note.

Example of the output for notes about clouds:

```markdown
---
flashy: headings
---
# Clouds

## Cumulus
A puffy cloud with a flat base that forms on warm, sunny days.

Grows into a storm cloud when the air keeps rising.

## Stratus
A flat grey layer that covers the whole sky like a blanket.

## Cirrus
A thin, wispy cloud made of ice crystals high in the sky.

- Height: above 6 km
- Often comes a day before rain
```
