# Flashidian brain

- Started 2026-11-24 from a browser prototype (a claude.ai artifact). The existing flashcard plugins (Spaced Repetition, Talking Cards, Decks, True Recall) all show the same Anki-like review screen: text on the background, four grade buttons, no card.
- Flashy differs in the review screen: two grades by swipe, a card with depth and a flip, colors from the Obsidian theme.
- Next: try it on an iPhone through BRAT (needs a GitHub release), check the swipe and pull-down conflicts and the flip in WebKit. Then FSRS with `ts-fsrs` (right = Good, left = Again) and review state in a vault file so it syncs between devices.
