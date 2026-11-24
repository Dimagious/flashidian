/** Right is "keep" (the card is learned), left is "repeat" (it goes into the next round). */
export type Grade = "keep" | "repeat";

/**
 * One round through a list of items. Pure state: the review modal draws it, the tests drive it directly.
 * `undo` steps back one card and forgets its grade.
 */
export class Session<T> {
    readonly items: readonly T[];
    private pos = 0;
    private readonly grades: Grade[] = [];

    constructor(items: readonly T[]) {
        this.items = items;
    }

    get index(): number {
        return this.pos;
    }

    get total(): number {
        return this.items.length;
    }

    get done(): boolean {
        return this.pos >= this.items.length;
    }

    get canUndo(): boolean {
        return this.grades.length > 0;
    }

    /** The item `offset` places after the current one, or undefined past the end. */
    peek(offset = 0): T | undefined {
        return this.items[this.pos + offset];
    }

    grade(g: Grade): void {
        if (this.done) return;
        this.grades.push(g);
        this.pos++;
    }

    /** Returns the grade that was taken back, or undefined when there is nothing to undo. */
    undo(): Grade | undefined {
        const g = this.grades.pop();
        if (g) this.pos--;
        return g;
    }

    count(g: Grade): number {
        return this.grades.filter((x) => x === g).length;
    }

    /** The items graded `g` in this round, in the order they were graded. */
    graded(g: Grade): T[] {
        return this.grades.flatMap((x, i) => (x === g ? [this.items[i] as T] : []));
    }
}

/** Fisher-Yates over a copy. `random` is injectable for tests. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j] as T, a[i] as T];
    }
    return a;
}
