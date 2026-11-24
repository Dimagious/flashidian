# Changelog

## [Unreleased]

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
