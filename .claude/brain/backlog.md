# Backlog

Open work. Priority: **P0** now · **P1** next release · **P2** worth doing · **P3** later. Size: S ≤ 1 session, M 1-3, L multi-session. When an item ships, mark it `done` with the date and PR.

| id | item | priority | size | status | source |
|---|---|---|---|---|---|
| B-01 | **Decisions and plans out of CLAUDE.md.** The progress-storage ADR (CLAUDE.md:52-68) goes to `brain/decisions/0001-progress-storage.md`; the roadmap (L77-88) becomes rows in this backlog; the prompts eval notes (L90-97) go to `brain/` or `evals/README.md`. CLAUDE.md keeps one line per decision with a link. | P0 | S | done 2026-11-25, PR #3 | Claude setup audit D3, 2026-11-25 (kit `.claude/brain/reports/2026-11-25-claude-setup-audit-d3.md`): D3-19 |
| B-02 | **CLAUDE.md without the kit's rules**: the lint/scorecard lines (L47) now come from `.claude/rules/opdk`; `el.style` → `setCssProps` (L38) and no regex lookbehind (L61) move into the kit (K-081) and leave CLAUDE.md after that | P0 | S | done 2026-11-25, PR #3 | Claude setup audit D3, 2026-11-25 (kit `.claude/brain/reports/2026-11-25-claude-setup-audit-d3.md`): D3-12, D3-13 |
| B-03 | **maker/checker from the kit (K-080)**: Flashy has no agents, so CI is its only check; take the shared pair when K-080 lands | P0 | S | done 2026-11-25, PR #3 | Claude setup audit D3, 2026-11-25 (kit `.claude/brain/reports/2026-11-25-claude-setup-audit-d3.md`) |
| B-04 | **Hint before the flip**: first letter and length of the answer (`s _ _ _ _`) | P2 | S | open | Roadmap agreed 2026-11-25, from a look at Quizlet's set page (was CLAUDE.md) |
| B-05 | **Stars without touching notes**: a star is a log entry; plus an automatic "Difficult" filter (cards sent left twice or more) | P2 | M | open | same roadmap |
| B-06 | **Keyboard help** on `?` in a round | P3 | S | open | same roadmap |
| B-07 | **Type the answer** with fuzzy matching for short answers; **autoplay** with speech | P3 | M | open | same roadmap |
| B-08 | **Replay cache and log snapshots**: logs are replayed in full on every open, fine for thousands of reviews | P3 | M | open | same roadmap; [ADR 0001](decisions/0001-progress-storage.md) |

Roadmap done before it moved here: mode tiles, front side, read aloud (0.7.x); match game (0.8.0, checked on an iPhone); catalog prep with films and listing stills (0.11.x).

Not taken from Quizlet: print, embed, merge, copy (Obsidian does these), calendar (the deck block does it), study with friends and live games (need a server), ads.
