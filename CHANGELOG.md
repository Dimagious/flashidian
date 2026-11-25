# Changelog

## [Unreleased]

### Fixed

- Read aloud on iPhone: a full language tag (`en-US`, not `en`) and no cancel right before speaking, which iOS answered with silence. When reading does not start, a notice says so and points at silent mode.
- The speaker stays in the top right corner after the card turns over.

## [0.7.0] - 2026-11-25

### Added

- Deck screen: the ways through a deck as three tiles, Cards, Quiz and Reverse, under the Study button.
- Front side: Term, Definition or Mixed, on the deck screen and in the settings. Definition shows the answer with the term hidden and asks for the term; the schedule is the same card's.
- Read aloud: a speaker on the card and the S key read the side in view. The term side speaks the note's `flashy-lang` (for example `es`), an answer is read in Russian when it is Cyrillic, otherwise in English.

### Fixed

- The quiz no longer masks a short answer: "Mexico City" for Mexico stays whole instead of showing "___ City". Terms are still hidden inside definitions.

## [0.6.0] - 2026-11-25

### Added

- Reverse quiz: the term is the question, four short definitions are the options, each with its own term hidden. Retrying the missed keeps the direction.

## [0.5.1] - 2026-11-24

- Quiz on a phone: options read from the left and keep their green and red, which Obsidian's mobile button style covered.

## [0.5.0] - 2026-11-24

- Quiz: up to 20 multiple choice questions from the deck screen. The question is the first plain paragraph of an answer with the term hidden, the options are four terms from the same review. Right picks move on, wrong ones show the answer; retry the missed at the end. Does not change the schedule.

## [0.4.0] - 2026-11-24

- Cards without special syntax: a note with `flashy: true` gives cards from its `##` headings, the rows of its tables or the items of its lists (`flashy: headings`, `table` or `list` picks one shape). A glossary is a deck as it is.
- *Create a deck from pasted text*: terms and definitions from Quizlet, a spreadsheet, a CSV file or a list become a deck note.
- A card that two notes share is reviewed once.
- Undo works after the review was written to the log: Flashy appends a line that cancels it, so the log stays append-only.
- Closing the review while a swiped card is still flying keeps its grade.

## [0.3.0] - 2026-11-24

- A `flashy` code block with `folder: <path>` draws a deck list in any note: one row per deck with today's cards and a learned bar, a row for all decks, one tap to start the review. It redraws when the review closes.
- Progress written a moment before a reload is no longer missed when the metadata cache still holds the old log.

## [0.2.0] - 2026-11-24

- FSRS scheduling: swipe right and a card comes back in days, then weeks; swipe left and it comes back tomorrow.
- A deck screen before the review: today's cards, new cards, learned cards, and when the next cards are due.
- Progress lives in the vault, in a `Flashy/` folder: one review log per device, so syncing two devices cannot conflict, and one note per deck with its numbers as properties for Bases. Notes with cards are never written to.
- A card keeps its progress when its deck is moved or renamed, and when its front is edited.
- Settings: the progress folder and new cards per day.

## [0.1.2] - 2026-11-24

- A close button in a top bar with the deck name, clear of the iPhone status bar and notch. Obsidian's own close button is hidden in the review, on desktop and on mobile.

## [0.1.1] - 2026-11-24

- First published release. The 0.1.0 tag was made by hand and never published; 0.1.1 has the same code.

## [0.1.0]

- Review modal: a stack of cards, 3D flip on tap, swipe right to keep and left to repeat with spring physics, undo, shuffle, an end-of-round summary that offers the cards to repeat.
- Reads the Spaced Repetition plugin's multi-line card format from a note or a whole folder.
- English and Russian interface.
