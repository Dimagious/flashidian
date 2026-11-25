/**
 * Prompt eval runner: every case in `evals/prompts/cases/` goes through one prompt from `prompts/` in a plain chat
 * assistant (headless `claude -p`, no tools, the user's subscription), then through Flashy's parsers and an Opus judge.
 *
 *   npm run eval:prompts -- --flow .claude/hillclimb/flashy-prompts-sonnet --variant v2 --model claude-sonnet-5-5 --reps 2
 *
 * Output per variant: `results.jsonl` (one row per case and rep, written as it finishes), `traces/<id>_rep<k>.json` and
 * `errors.jsonl` for attempts that produced nothing to grade. A rerun skips the (case, rep) pairs already written.
 * `baseline` runs the prompts frozen in `evals/prompts/variants/baseline/`, any other variant runs `prompts/` as it is.
 *
 * The runner refuses to start when the harness (this file, the grader, the prompts) changed since a person last
 * approved it with `--approve-harness`: a round that edits a prompt cannot run unreviewed.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CaseMeta, gradeReply, JUDGE_SCHEMA, judgePrompt, PROMPT_FILE } from "./grade";

const CASES = "evals/prompts/cases";
const ASSISTANT = "You are Claude, a helpful assistant.";
const JUDGE = { model: "claude-opus-5-5", system: "You grade flashcards against their source. Fill the schema." };
const HARNESS = ["evals/prompts/run.ts", "evals/prompts/grade.ts"];
const LISTS = new Set(["must", "must_not", "files", "prompt_for", "no_prompt_for", "skip"]);

interface Args {
    flow: string;
    variant: string;
    model: string;
    reps: number;
    concurrency: number;
    timeoutS: number;
    approve: boolean;
}

interface Case {
    id: string;
    meta: CaseMeta & { hard: string };
    source: string;
}

interface Claude {
    result: string;
    model: string;
    usage: Record<string, unknown>;
    stop_reason: string;
    duration_ms: number;
    structured_output?: { faithful?: boolean; focused?: boolean; issues?: string };
}

/** The fields of `claude -p --output-format json` the runner reads. */
interface RawResult {
    is_error?: boolean;
    api_error_status?: number | null;
    result?: string;
    modelUsage?: Record<string, unknown>;
    usage?: Record<string, unknown>;
    stop_reason?: string;
    duration_ms?: number;
    structured_output?: Claude["structured_output"];
}

class Failure extends Error {
    constructor(
        message: string,
        readonly failureClass: "timeout" | "api_error" | "harness_error",
        readonly transient = false,
    ) {
        super(message);
    }
}

function parseArgs(argv: string[]): Args {
    const a: Args = { flow: "", variant: "", model: "", reps: 1, concurrency: 4, timeoutS: 300, approve: false };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = (): string => {
            const next = argv[++i];
            if (next === undefined) throw new Error(`${k ?? ""} needs a value`);
            return next;
        };
        if (k === "--flow") a.flow = v();
        else if (k === "--variant") a.variant = v();
        else if (k === "--model") a.model = v();
        else if (k === "--reps") a.reps = Number(v());
        else if (k === "--concurrency") a.concurrency = Number(v());
        else if (k === "--timeout-s") a.timeoutS = Number(v());
        else if (k === "--approve-harness") a.approve = true;
        else throw new Error(`unknown argument ${k ?? ""}`);
    }
    if (!a.flow || !a.model || !/^(baseline|v\d+)$/.test(a.variant) || !(a.reps >= 1) || !(a.concurrency >= 1)) {
        throw new Error("usage: --flow DIR --variant baseline|vN --model ID [--reps N] [--concurrency N] [--timeout-s N] [--approve-harness]");
    }
    return a;
}

function loadCases(): Case[] {
    const only = (process.env.EVAL_CASES ?? "").split(",").filter(Boolean);
    return readdirSync(CASES)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => {
            const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(readFileSync(join(CASES, f), "utf8"));
            if (!m?.[1] || m[2] === undefined) throw new Error(`${f}: no properties block`);
            const meta: Record<string, string | string[]> = {};
            for (const line of m[1].split("\n")) {
                const i = line.indexOf(":");
                const key = line.slice(0, i).trim();
                const value = line.slice(i + 1).trim();
                meta[key] = LISTS.has(key) ? value.split(",").map((s) => s.trim()).filter(Boolean) : value;
            }
            return { id: f.replace(/\.md$/, ""), meta: meta as unknown as Case["meta"], source: m[2].trim() };
        })
        .filter((c) => !only.length || only.includes(c.id));
}

function promptDir(variant: string): string {
    return variant === "baseline" ? "evals/prompts/variants/baseline" : "prompts";
}

function harnessFiles(): string[] {
    const prompts = Object.values(PROMPT_FILE).flatMap((p) => [`prompts/${p}.md`, `evals/prompts/variants/baseline/${p}.md`]);
    return [...HARNESS, ...prompts];
}

/** Refuses to run a harness nobody approved; `--approve-harness` records the current one. */
function checkHarness(statePath: string, approve: boolean): void {
    const state = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
    const h = createHash("sha256");
    for (const f of harnessFiles()) h.update(f).update("\0").update(readFileSync(f)).update("\0");
    const sha = h.digest("hex");
    if (state.harness_sha === sha) return;
    if (approve) {
        writeFileSync(statePath, `${JSON.stringify({ ...state, harness_sha: sha }, null, 2)}\n`);
        console.error(`harness approved: ${sha.slice(0, 12)} over ${harnessFiles().length} files`);
        return;
    }
    console.error(`the harness changed since it was approved (now ${sha.slice(0, 12)}). Review it, then rerun with --approve-harness.`);
    process.exit(2);
}

/** One headless call with a plain assistant system prompt and no tools. */
function claude(model: string, system: string, message: string, timeoutS: number, schema?: object): Promise<Claude> {
    const argv = ["-p", "--model", model, "--system-prompt", system, "--tools", "", "--strict-mcp-config", "--setting-sources", "",
        "--no-session-persistence", "--output-format", "json"];
    if (schema) argv.push("--json-schema", JSON.stringify(schema));
    return new Promise((resolve, reject) => {
        const child = spawn("claude", argv, { cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        let err = "";
        const timer = timeoutS > 0
            ? setTimeout(() => {
                child.kill();
                reject(new Failure(`no answer in ${timeoutS} s`, "timeout"));
            }, timeoutS * 1000)
            : undefined;
        child.stdout.on("data", (d: Buffer) => (out += d.toString()));
        child.stderr.on("data", (d: Buffer) => (err += d.toString()));
        child.on("error", (e) => reject(new Failure(`cannot start claude: ${e.message}`, "harness_error")));
        child.on("close", (code) => {
            clearTimeout(timer);
            let j: RawResult;
            try {
                j = JSON.parse(out) as RawResult;
            } catch {
                return reject(new Failure(`claude exited ${code ?? "?"}: ${(err || out).slice(0, 300)}`, "api_error", true));
            }
            if (j.is_error) {
                const status = Number(j.api_error_status);
                const text = j.result ?? "";
                const transient = status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/i.test(text);
                return reject(new Failure(`claude error ${status || ""}: ${text.slice(0, 300)}`, "api_error", transient));
            }
            resolve({
                result: j.result ?? "",
                model: Object.keys(j.modelUsage ?? {})[0] ?? "",
                usage: j.usage ?? {},
                stop_reason: j.stop_reason ?? "",
                duration_ms: j.duration_ms ?? 0,
                structured_output: j.structured_output,
            });
        });
        child.stdin.end(message);
    });
}

/** Retries a transient failure with jittered backoff; the retry count goes into the row. */
async function withRetry<T>(fn: () => Promise<T>, retries: { n: number }, tries = 4): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (e) {
            if (!(e instanceof Failure) || !e.transient || attempt >= tries - 1) throw e;
            retries.n++;
            await new Promise((r) => setTimeout(r, Math.min(60_000, 2000 * 2 ** attempt) * (0.5 + Math.random())));
        }
    }
}

async function runOne(c: Case, rep: number, args: Args, dir: string): Promise<void> {
    const prompt = readFileSync(join(promptDir(args.variant), `${PROMPT_FILE[c.meta.recipe]}.md`), "utf8").trim();
    const message = `${prompt}\n\n${c.source}`;
    const retries = { n: 0 };
    const started = Date.now();
    let run: Claude | undefined;
    try {
        run = await withRetry(() => claude(args.model, ASSISTANT, message, args.timeoutS), retries);
        if (run.model !== args.model) throw new Failure(`served by ${run.model}, asked for ${args.model}`, "harness_error");
        const graded = gradeReply(c.meta, run.result, c.source);
        const judge = await withRetry(() => claude(JUDGE.model, JUDGE.system, judgePrompt(c.meta, c.source, graded), args.timeoutS, JUDGE_SCHEMA), retries);
        const v = judge.structured_output;
        if (typeof v?.faithful !== "boolean" || typeof v.focused !== "boolean") throw new Failure("the judge returned no verdict", "harness_error");
        const issues = v.issues ?? "";
        writeFileSync(join(dir, "traces", `${c.id}_rep${rep}.json`), `${JSON.stringify([
            { role: "system", content: ASSISTANT },
            { role: "user", content: message },
            { role: "assistant", content: run.result },
        ], null, 2)}\n`);
        appendFileSync(join(dir, "results.jsonl"), `${JSON.stringify({
            prompt_id: c.id,
            rep,
            prompt: c.source,
            tags: [c.meta.recipe, c.meta.lang, c.meta.hard],
            status: run.stop_reason === "max_tokens" ? "truncated" : "ok",
            stop_reason: run.stop_reason,
            grade: { ...graded.grade, faithful: v.faithful ? 1 : 0, focused: v.focused ? 1 : 0 },
            explanation: { ...graded.explanation, faithful: issues, focused: issues },
            model: run.model,
            usage: run.usage,
            judge_model: judge.model,
            judge_usage: judge.usage,
            latency_s: run.duration_ms / 1000,
            ...(retries.n ? { meta: { retries: retries.n } } : {}),
        })}\n`);
    } catch (e) {
        const failure = e instanceof Failure ? e : new Failure(e instanceof Error ? e.message : String(e), "harness_error");
        appendFileSync(join(dir, "errors.jsonl"), `${JSON.stringify({
            prompt_id: c.id,
            rep,
            failure_class: failure.failureClass,
            error: failure.message,
            retries: retries.n,
            seconds: (Date.now() - started) / 1000,
            ...(run ? { model: run.model, usage: run.usage } : {}),
        })}\n`);
        throw failure;
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const statePath = join(args.flow, "_state.json");
    if (!existsSync(statePath)) throw new Error(`${statePath} is missing: it declares the metrics for the report`);
    checkHarness(statePath, args.approve);

    const dir = join(args.flow, args.variant);
    mkdirSync(join(dir, "traces"), { recursive: true });
    const resultsPath = join(dir, "results.jsonl");
    const done = new Set(
        existsSync(resultsPath)
            ? readFileSync(resultsPath, "utf8").trim().split("\n").filter(Boolean).map((l) => {
                const r = JSON.parse(l) as { prompt_id: string; rep: number };
                return `${r.prompt_id}#${r.rep}`;
            })
            : [],
    );
    const queue = loadCases().flatMap((c) => Array.from({ length: args.reps }, (_, rep) => ({ c, rep })))
        .filter(({ c, rep }) => !done.has(`${c.id}#${rep}`));
    console.error(`[${args.variant}] ${queue.length} to run on ${args.model}`);

    const started = Date.now();
    let ok = 0;
    let failed = 0;
    const worker = async (): Promise<void> => {
        for (let job = queue.shift(); job; job = queue.shift()) {
            try {
                await runOne(job.c, job.rep, args, dir);
                ok++;
            } catch (e) {
                failed++;
                console.error(`  ${job.c.id} rep${job.rep}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    };
    await Promise.all(Array.from({ length: args.concurrency }, worker));
    console.error(`[${args.variant}] ${ok} ok, ${failed} failed, ${Math.round((Date.now() - started) / 1000)} s -> ${resultsPath}`);
    if (failed) process.exitCode = 1;
}

main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
