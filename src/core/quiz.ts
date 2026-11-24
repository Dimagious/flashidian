/**
 * Multiple choice from a deck: the question is the gist of a card's answer, the options are fronts of cards from the
 * same review. Terms make short buttons on a phone; four definitions would not fit.
 */

const MAX_GIST = 280;

/**
 * The first plain paragraph of an answer: callouts, tables, lists, headings, code and images are skipped, line breaks
 * joined. Cut at a word boundary when long.
 */
export function gist(back: string): string {
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
        if (text.length <= MAX_GIST) return text;
        const cut = text.slice(0, MAX_GIST);
        return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), MAX_GIST / 2))}…`;
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

/** Hides the term inside its own definition, so the question does not give the answer away. */
export function mask(text: string, term: string): string {
    const plain = plainTerm(term);
    if (plain.length < 3) return text;
    return text.replace(new RegExp(escapeRe(plain), "gi"), "___");
}

export interface Question<T> {
    item: T;
    prompt: string;
    options: T[];
    answer: number;
}

/**
 * Up to `count` questions in random order. Each takes up to three other cards with a different front and a usable
 * answer as wrong options. Cards whose answer has no plain paragraph are left out. Fewer than two usable cards: no quiz.
 */
export function buildQuiz<T>(
    items: readonly T[],
    front: (t: T) => string,
    back: (t: T) => string,
    count: number,
    random: () => number = Math.random,
): Question<T>[] {
    const usable = items.map((item) => ({ item, f: front(item).trim(), g: gist(back(item)) })).filter((x) => x.f && x.g);
    if (usable.length < 2) return [];
    const order = shuffleWith(usable, random).slice(0, count);
    return order.map((q) => {
        const others = shuffleWith(
            usable.filter((x) => x.f.toLowerCase() !== q.f.toLowerCase()),
            random,
        );
        const picked: typeof usable = [];
        for (const o of others) {
            if (picked.length === 3) break;
            if (!picked.some((p) => p.f.toLowerCase() === o.f.toLowerCase())) picked.push(o);
        }
        const options = shuffleWith([q, ...picked], random);
        return { item: q.item, prompt: mask(q.g, q.f), options: options.map((o) => o.item), answer: options.indexOf(q) };
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
