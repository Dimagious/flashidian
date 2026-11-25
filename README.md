# Flashy

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Dimagious/flashidian/HEAD/docs/banner-dark.svg">
  <img alt="Flashy (flashidian): your notes are already flashcards. A row of a table in a note, Japan and Tokyo, becomes a card swiped right as got it"
       src="https://raw.githubusercontent.com/Dimagious/flashidian/HEAD/docs/banner-light.svg">
</picture>

[![Latest release](https://img.shields.io/github/v/release/Dimagious/flashidian?color=6f4fe0)](https://github.com/Dimagious/flashidian/releases)
[![Obsidian 1.13+](https://img.shields.io/badge/Obsidian-1.13%2B-6f4fe0)](https://obsidian.md)
[![Languages](https://img.shields.io/badge/languages-7-6f4fe0)](#seven-languages)
[![License: MIT](https://img.shields.io/badge/license-MIT-6f4fe0)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/support-buy%20me%20a%20coffee-6f4fe0)](https://buymeacoffee.com/dimagious)

**Your notes are already flashcards.**

Headings, tables, lists and question callouts become a deck as they are. Review with a tap and a swipe on your phone. Nothing is written into your notes.

<img alt="Flashy on a phone: a table of countries and capitals in a note, the same note as a deck with today's cards, a card flipped to its answer, swiped right with a green Got it, the next one swiped left with an orange Again, and the ring at the end of the round" src="https://raw.githubusercontent.com/Dimagious/flashidian/HEAD/docs/screens/hero.gif" width="100%">

**Install:** Settings → **Community plugins** → **Browse** → search for **Flashy**. Until Flashy is listed there, install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat) from `Dimagious/flashidian`. Then open a note with a table or a glossary, add the property `flashy: true` and run **Flashy: Review cards in the current note**.

[Every format and setting](docs/reference.md) · [Changelog](CHANGELOG.md)

## Why Flashy

- **No card syntax.** The notes you already have are the deck: a glossary, a table, a list, a callout with a question.
- **Made for the phone.** One card at a time, a 3D flip, swipe right when you know it, left to see it again.
- **Your notes stay clean.** No scheduling comments, no IDs. Progress lives in a `Flashy/` folder and syncs without conflicts.
- **FSRS scheduling**, and the multi-line `?` format of the Spaced Repetition plugin works as it is.

## Any note can be a deck

A glossary of `##` headings, question callouts, or a whole short note as one card. A table and a list work the same way.

<img alt="On a phone: a biology glossary whose headings become cards, Nucleus on the front and its definition on the back; a note of question callouts whose questions become cards; and a short note about the octopus that becomes one card with its question on the front" src="https://raw.githubusercontent.com/Dimagious/flashidian/HEAD/docs/screens/formats.gif" width="100%">

## Your notes stay untouched

Reviews go to a log in `Flashy/`, one file per device, so two devices never conflict. Each deck gets a note with its numbers as properties, ready for Bases.

<img alt="On a phone: a note of Spanish cards in source mode, a review with a card swiped right, the same note afterwards without a single change, and the deck's progress note in the Flashy folder with its numbers as properties" src="https://raw.githubusercontent.com/Dimagious/flashidian/HEAD/docs/screens/untouched.gif" width="100%">

## Cards from your lecture notes

Copy a ready prompt, paste it with your notes into the assistant you use, and save the reply as a note: it is a deck. Four prompts, for lecture notes, foreign words, a chapter and short notes, each [checked on 24 sample inputs](evals/prompts/). Flashy itself calls no model and sends nothing anywhere.

<img alt="On a phone: messy lecture notes on economics, the prompt picker with four kinds of material, a notice that the prompt is copied, the assistant's reply saved as a note of headings, and the deck it makes with Demand on the first card" src="https://raw.githubusercontent.com/Dimagious/flashidian/HEAD/docs/screens/prompt.gif" width="100%">

## Quiz and Match

Four ways through a deck: cards, a quiz, a reverse quiz, and Match, pairs against the clock with a best time per deck. The quizzes and Match leave the schedule alone.

<img alt="On a phone: the deck screen with four modes, a quiz where the right country for a capital turns green, and the Match grid where countries and capitals are tapped in pairs until a new best time" src="https://raw.githubusercontent.com/Dimagious/flashidian/HEAD/docs/screens/modes.gif" width="100%">

## Coming from Spaced Repetition

Your `?` decks open as they are, and Flashy leaves the plugin's `<!--SR:...-->` comments alone, so both plugins can run on the same notes. Flashy keeps its own schedule: your Spaced Repetition history does not carry over.

## Seven languages

English, Russian, Spanish, German, French, Portuguese and Japanese. Flashy follows Obsidian's language; pick another under **Language** in the settings.

<sub>The clips are the plugin running in Obsidian's mobile interface, in a phone-sized window on a desktop, with a demo vault.</sub>

## License

MIT
