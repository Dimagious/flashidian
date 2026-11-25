/**
 * Multiple choice from a deck. Forward: the question is the gist of a card's answer, the options are fronts of cards
 * from the same review. Reverse: the question is the front, the options are short gists, each with its own term hidden,
 * so they still fit a phone.
 */

const MAX_GIST = 280;
/** Definitions as options: four of them have to fit a phone screen. */
const MAX_OPTION = 160;

/**
 * The first plain paragraph of an answer: callouts, tables, lists, headings, code and images are skipped, line breaks
 * joined. Cut at a word boundary when long.
 */
export function gist(back: string, max = MAX_GIST): string {
    const blocks = back.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
    let inFence = false;
    for (const block of blocks) {
        const fences = (block.match(/^\s*(```|~~~)/gm) ?? []).length;
        const wasInFence = inFence;
        if (fences % 2 === 1) inFence = !inFence;
        if (wasInFence || fences) continue;
        const first = block.trimStart();
        if (!first || /^(>|\||[-*+]\s|\d+[.)]\s|#|!\[\[|!\[|%%|<!--)/.test(first)) continue;
        const text = block
            .split("\n")
            .map((l) => l.trim())
            .join(" ")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\s+/g, " ")
            .trim();
        if (text.length <= max) return text;
        const cut = text.slice(0, max);
        return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2))}…`;
    }
    return "";
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A front as plain text: bold and code marks go, underscores inside names like `stop_reason` stay. */
export function plainTerm(front: string): string {
    return front.replace(/\*\*|__|`/g, "").replace(/^\*(.+)\*$/, "$1").trim();
}

/** Option text is shown as is, not rendered: code marks, italics and links go. */
function plainText(text: string): string {
    return text
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, "$1$2");
}

/**
 * Hides the term inside its own definition, so the question does not give the answer away. A short answer (three words
 * or fewer) is a name, not a sentence: "Mexico City" stays as it is instead of turning into "___ City".
 */
export function mask(text: string, term: string): string {
    const plain = plainTerm(term);
    if (plain.length < 3 || text.trim().split(/\s+/).length <= 3) return text;
    return text.replace(new RegExp(escapeRe(plain), "gi"), "___");
}

export interface Question<T> {
    item: T;
    /** Markdown: the masked definition, or the term in reverse. */
    prompt: string;
    options: T[];
    /** Plain text of each option, in the order of `options`. */
    labels: string[];
    answer: number;
}

export interface QuizOptions {
    random?: () => number;
    /** Show the term, pick its definition. */
    reverse?: boolean;
}

/**
 * Up to `count` questions in random order. Each takes up to three other cards with a different front and a different
 * option text as wrong options. Cards whose answer has no plain paragraph are left out. Fewer than two usable cards: no
 * quiz.
 */
export function buildQuiz<T>(
    items: readonly T[],
    front: (t: T) => string,
    back: (t: T) => string,
    count: number,
    { random = Math.random, reverse = false }: QuizOptions = {},
): Question<T>[] {
    const usable = items
        .map((item) => {
            const f = front(item).trim();
            const b = back(item);
            return { item, f, g: gist(b), label: reverse ? mask(plainText(gist(b, MAX_OPTION)), f) : plainTerm(f) };
        })
        .filter((x) => x.f && x.g && x.label);
    if (usable.length < 2) return [];
    const same = (a: (typeof usable)[number], b: (typeof usable)[number]): boolean =>
        a.f.toLowerCase() === b.f.toLowerCase() || a.label.toLowerCase() === b.label.toLowerCase();
    const order = shuffleWith(usable, random).slice(0, count);
    return order.map((q) => {
        const picked: typeof usable = [];
        for (const o of shuffleWith(usable, random)) {
            if (picked.length === 3) break;
            if (!same(o, q) && !picked.some((p) => same(p, o))) picked.push(o);
        }
        const options = shuffleWith([q, ...picked], random);
        return {
            item: q.item,
            prompt: reverse ? q.f : mask(q.g, q.f),
            options: options.map((o) => o.item),
            labels: options.map((o) => o.label),
            answer: options.indexOf(q),
        };
    });
}

function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j] as T, a[i] as T];
    }
    return a;
}
