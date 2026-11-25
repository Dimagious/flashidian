# Prompts and their eval (2026-11-25)

No generation inside the plugin (no keys, no model calls): it ships prompts the user pastes into their own assistant. `evals/prompts/` checks them: 24 synthetic cases (6 per prompt, en and ru), each reply parsed by the real parsers, plus a judge for faithfulness and focus.

- Run: `npm run eval:prompts -- --flow .claude/hillclimb/flashy-prompts-<sonnet|haiku> --variant vN --model claude-<sonnet|haiku>-5-5 --reps 2`. `baseline` runs `evals/prompts/variants/baseline/`, every other variant runs `prompts/`. Reports: the lite builder from the claude-api skill, `report.html` in each flow (gitignored).
- A changed harness (runner, grader, prompts) needs `--approve-harness`, passed by Dmitriy, not by an agent.
- Change a prompt: the example in it must still parse (`src/core/prompts.test.ts`), then a new variant on both models.
- What the eval taught: a prompt must end with an explicit line before the pasted material; the note example had the same `### File.md` shape as the notes, and the small model took the notes for more example. "No details from your own knowledge, even true ones" stopped invented causes in answers.
- Results so far: Haiku valid 0.75 at baseline, 1.00 from v2; Sonnet about 1.00 throughout. v3 brought note-card focus on Haiku from 0.92 to 1.00. Noise is about 14 points at 48 runs.
- The community scanner reads every tracked file and only `tsconfig.json`: a Node script inside `tsconfig.json` costs scorecard points, so `evals/` has its own `tsconfig.evals.json` and sits in the eslint ignores.
