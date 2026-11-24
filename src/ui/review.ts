import { type App, Component, getLanguage, MarkdownRenderer, Modal, setIcon } from "obsidian";
import type { DeckCard, DeckProgress } from "../app/progress";
import { type Grade, Session, shuffle } from "../core/session";
import { type Strings, strings } from "./strings";

const STACK = 3;
/** Share of the card width a drag must pass to count as a grade. */
const THRESHOLD = 0.32;
/** Spring constants per millisecond: about a 0.4 s period, a little overshoot. */
const SPRING_K = 0.00026;
const SPRING_C = 0.019;

/** A scheduled round writes every grade to the log; a practice round (the cards sent left, again) writes nothing. */
type RoundKind = "scheduled" | "practice";

export class ReviewModal extends Modal {
    /** Called once the reviews of this modal are written, so a deck list can redraw with the new numbers. */
    onClosed?: () => void;
    private session: Session<DeckCard> = new Session<DeckCard>([]);
    private kind: RoundKind = "scheduled";
    private shuffled = false;
    private busy = false;
    private readonly t: Strings = strings();
    private readonly md = new Component();
    private readonly nodes = new Map<number, HTMLElement>();
    private readonly reduceMotion = activeWindow.matchMedia("(prefers-reduced-motion: reduce)").matches;

    private root!: HTMLElement;
    private stage!: HTMLElement;
    private countEl!: HTMLElement;
    private barEl!: HTMLElement;
    private keepEl!: HTMLElement;
    private repeatEl!: HTMLElement;
    private undoBtn!: HTMLButtonElement;
    private actionBtns: HTMLButtonElement[] = [];
    private legend!: HTMLElement;

    constructor(
        app: App,
        private readonly progress: DeckProgress,
    ) {
        super(app);
    }

    onOpen(): void {
        this.md.load();
        this.modalEl.addClass("flashy-modal");
        // Obsidian mobile opens the sidebars on a horizontal swipe; this attribute tells it to leave the swipe to us.
        this.modalEl.setAttr("data-ignore-swipe", "true");
        this.build();
        const inRound = (): boolean => this.root.hasClass("is-round");
        this.scope.register([], "ArrowRight", () => (inRound() && this.fling(1), false));
        this.scope.register([], "ArrowLeft", () => (inRound() && this.fling(-1), false));
        this.scope.register([], " ", () => (inRound() && this.flip(), false));
        this.scope.register([], "ArrowUp", () => (inRound() && this.flip(), false));
        this.scope.register([], "ArrowDown", () => (inRound() && this.flip(), false));
        this.scope.register([], "Backspace", () => (inRound() && this.undo(), false));
        this.showDeck();
    }

    onClose(): void {
        void this.progress.save().then(() => this.onClosed?.());
        this.md.unload();
        this.contentEl.empty();
        this.nodes.clear();
    }

    private build(): void {
        const root = (this.root = this.contentEl.createDiv({ cls: "flashy" }));

        // Our own close button: Obsidian's sits at the very top, under the status bar and the notch on an iPhone.
        const top = root.createDiv({ cls: "flashy-top" });
        const close = top.createEl("button", { cls: "flashy-close clickable-icon", attr: { "aria-label": this.t.close } });
        setIcon(close, "x");
        close.addEventListener("click", () => this.close());
        top.createDiv({ cls: "flashy-title", text: this.title() });

        const hud = root.createDiv({ cls: "flashy-hud flashy-round-only" });
        this.repeatEl = hud.createDiv({ cls: "flashy-pill is-repeat", attr: { "aria-label": this.t.repeat } });
        setIcon(this.repeatEl.createSpan(), "chevron-left");
        this.repeatEl.createSpan({ cls: "flashy-n", text: "0" });
        const prog = hud.createDiv({ cls: "flashy-prog" });
        this.countEl = prog.createSpan({ cls: "flashy-count" });
        this.barEl = prog.createDiv({ cls: "flashy-bar" }).createDiv();
        this.keepEl = hud.createDiv({ cls: "flashy-pill is-keep", attr: { "aria-label": this.t.keep } });
        this.keepEl.createSpan({ cls: "flashy-n", text: "0" });
        setIcon(this.keepEl.createSpan(), "chevron-right");

        this.stage = root.createDiv({ cls: "flashy-stage" });
        this.legend = this.stage.createDiv({ cls: "flashy-legend flashy-round-only" });
        this.legend.createSpan({ text: this.t.swipeLeft });
        this.legend.createSpan({ text: this.t.tapCard });
        this.legend.createSpan({ text: this.t.swipeRight });

        const bar = root.createDiv({ cls: "flashy-controls flashy-round-only" });
        const btn = (cls: string, icon: string, label: string, text: string | null, onClick: () => void, iconLast = false): HTMLButtonElement => {
            const b = bar.createEl("button", { cls: `flashy-btn ${cls}`, attr: { "aria-label": label } });
            const i = createSpan();
            setIcon(i, icon);
            if (!iconLast) b.appendChild(i);
            if (text) b.createSpan({ text });
            if (iconLast) b.appendChild(i);
            b.addEventListener("click", onClick);
            return b;
        };
        this.undoBtn = btn("is-small", "undo-2", this.t.undo, null, () => this.undo());
        const no = btn("is-repeat", "chevron-left", this.t.repeat, this.t.repeat, () => this.fling(-1));
        const flip = btn("mod-cta", "refresh-cw", this.t.answer, this.t.answer, () => this.flip());
        const yes = btn("is-keep", "chevron-right", this.t.keep, this.t.keep, () => this.fling(1), true);
        const shuf = btn("is-small", "shuffle", this.t.shuffle, null, () => {
            this.shuffled = !this.shuffled;
            shuf.toggleClass("is-active", this.shuffled);
            this.start(this.session.items.slice(), this.kind);
        });
        this.actionBtns = [no, flip, yes];
    }

    /** The deck name when every card comes from one note, otherwise the number of notes. */
    private title(): string {
        const decks = new Set(this.progress.items.map((c) => c.deck));
        const [only] = decks;
        return decks.size === 1 && only ? only : this.t.decks(decks.size);
    }

    private clearStage(): void {
        for (const el of Array.from(this.stage.querySelectorAll(".flashy-card, .flashy-done, .flashy-home"))) el.remove();
        this.nodes.clear();
    }

    // ---------- deck screen ----------

    private showDeck(): void {
        this.clearStage();
        this.root.removeClass("is-round");
        const s = this.progress.stats();
        const today = this.progress.today();
        const home = this.stage.createDiv({ cls: "flashy-home" });
        home.createDiv({ cls: "flashy-home-total", text: this.t.total(s.total) });
        const grid = home.createDiv({ cls: "flashy-home-grid" });
        const cell = (cls: string, n: number, label: string): void => {
            const c = grid.createDiv({ cls: `flashy-home-cell ${cls}` });
            c.createDiv({ cls: "flashy-home-n", text: String(n) });
            c.createDiv({ cls: "flashy-home-label", text: label });
        };
        cell("is-today", today.length, this.t.today);
        cell("is-new", s.fresh, this.t.fresh);
        cell("is-learned", s.learned, this.t.learned);

        const acts = home.createDiv({ cls: "flashy-acts" });
        const study = acts.createEl("button", { cls: "mod-cta", text: today.length ? this.t.study(today.length) : this.t.allDone });
        study.disabled = !today.length;
        study.addEventListener("click", () => this.start(today, "scheduled"));
        acts.createEl("button", { text: this.t.practiceAll(s.total) }).addEventListener("click", () => this.start(this.progress.items, "scheduled"));
        const next = this.progress.nextDue();
        if (!today.length && next) home.createDiv({ cls: "flashy-home-note", text: this.t.nextOn(next.toLocaleDateString(getLanguage(), { day: "numeric", month: "long" })) });
    }

    // ---------- round ----------

    private start(cards: readonly DeckCard[], kind: RoundKind): void {
        this.clearStage();
        this.kind = kind;
        this.root.addClass("is-round");
        this.root.toggleClass("is-practice", kind === "practice");
        this.session = new Session(this.shuffled ? shuffle(cards) : cards.slice());
        this.busy = false;
        this.layout();
        this.hud();
    }

    private top(): HTMLElement | undefined {
        return this.nodes.get(this.session.index);
    }

    /** Keeps the top three cards in the DOM and sets their depth; a card moving up animates through CSS. */
    private layout(): void {
        const i = this.session.index;
        for (const [p, el] of this.nodes) {
            if (p < i || p >= i + STACK) {
                el.remove();
                this.nodes.delete(p);
            }
        }
        for (let k = 0; k < STACK; k++) {
            const item = this.session.peek(k);
            if (!item) break;
            let el = this.nodes.get(i + k);
            if (!el) {
                el = this.makeCard(item);
                el.dataset.depth = String(Math.min(k + 1, STACK - 1));
                this.stage.prepend(el);
                this.nodes.set(i + k, el);
                void el.offsetWidth;
            }
            el.dataset.depth = String(k);
        }
    }

    private makeCard(item: DeckCard): HTMLElement {
        const el = createDiv({ cls: "flashy-card" });
        const flipper = el.createDiv({ cls: "flashy-flipper" });
        const front = flipper.createDiv({ cls: "flashy-face flashy-front" });
        front.createDiv({ cls: "flashy-deck", text: item.deck });
        const term = front.createDiv({ cls: "flashy-term markdown-rendered" });
        front.createDiv({ cls: "flashy-hint", text: this.t.tapHint });
        const back = flipper.createDiv({ cls: "flashy-face flashy-back" });
        const scroll = back.createDiv({ cls: "flashy-scroll markdown-rendered" });
        void MarkdownRenderer.render(this.app, item.card.front, term, item.path, this.md);
        void MarkdownRenderer.render(this.app, item.card.back, scroll, item.path, this.md);
        el.createDiv({ cls: "flashy-glow" });
        el.createDiv({ cls: "flashy-stamp is-keep", text: this.t.keep });
        el.createDiv({ cls: "flashy-stamp is-repeat", text: this.t.repeat });
        this.bindDrag(el);
        return el;
    }

    private hud(): void {
        const s = this.session;
        this.countEl.setText(`${Math.min(s.index + 1, s.total)} / ${s.total}`);
        this.barEl.setCssProps({ "--flashy-progress": `${s.total ? (s.index / s.total) * 100 : 0}%` });
        this.repeatEl.querySelector(".flashy-n")?.setText(String(s.count("repeat")));
        this.keepEl.querySelector(".flashy-n")?.setText(String(s.count("keep")));
        this.undoBtn.disabled = !s.canUndo;
        for (const b of this.actionBtns) b.disabled = s.done;
        this.legend.toggleClass("is-hidden", s.done);
    }

    private bump(el: HTMLElement): void {
        el.removeClass("is-bump");
        void el.offsetWidth;
        el.addClass("is-bump");
    }

    // ---------- motion ----------

    private pose(el: HTMLElement, x: number, y: number): void {
        const w = el.offsetWidth || 360;
        const t = Math.max(-1, Math.min(1, x / (w * THRESHOLD)));
        el.setCssProps({
            "--flashy-x": `${x}px`,
            "--flashy-y": `${y}px`,
            "--flashy-r": `${(x / w) * 16}deg`,
            "--flashy-keep": String(Math.max(0, t)),
            "--flashy-repeat": String(Math.max(0, -t)),
        });
    }

    private rest(el: HTMLElement): void {
        this.pose(el, 0, 0);
        el.removeClass("is-live");
    }

    private spring(el: HTMLElement, x: number, y: number, vx: number, vy: number): void {
        if (this.reduceMotion) return this.rest(el);
        el.addClass("is-live");
        let last = performance.now();
        const step = (now: number): void => {
            const dt = Math.min(32, now - last);
            last = now;
            for (let s = 0; s < 2; s++) {
                const h = dt / 2;
                vx += (-SPRING_K * x - SPRING_C * vx) * h;
                vy += (-SPRING_K * y - SPRING_C * vy) * h;
                x += vx * h;
                y += vy * h;
            }
            if (Math.abs(x) < 0.4 && Math.abs(y) < 0.4 && Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) return this.rest(el);
            this.pose(el, x, y);
            activeWindow.requestAnimationFrame(step);
        };
        activeWindow.requestAnimationFrame(step);
    }

    private fling(dir: 1 | -1, x = 0, y = 0, vx = 0, vy = -0.15): void {
        const el = this.top();
        if (!el || this.busy) return;
        this.busy = true;
        vx = dir * Math.max(Math.abs(vx), 1.6);
        vy = Math.max(-1, Math.min(1, vy));
        el.addClass("is-live");
        if (this.reduceMotion) return this.commit(dir > 0 ? "keep" : "repeat");
        const limit = activeWindow.innerWidth * 0.6 + el.offsetWidth;
        let last = performance.now();
        const step = (now: number): void => {
            const dt = Math.min(32, now - last);
            last = now;
            vx += dir * 0.004 * dt;
            x += vx * dt;
            y += vy * dt;
            this.pose(el, x, y);
            if (Math.abs(x) > limit) return this.commit(dir > 0 ? "keep" : "repeat");
            activeWindow.requestAnimationFrame(step);
        };
        activeWindow.requestAnimationFrame(step);
    }

    private commit(g: Grade): void {
        const item = this.session.peek();
        this.top()?.remove();
        this.nodes.delete(this.session.index);
        if (item && this.kind === "scheduled") this.progress.record(item, g);
        this.session.grade(g);
        this.bump(g === "keep" ? this.keepEl : this.repeatEl);
        this.busy = false;
        this.layout();
        this.hud();
        if (this.session.done) this.finish();
    }

    private undo(): void {
        if (!this.session.canUndo || this.busy) return;
        this.stage.querySelector(".flashy-done")?.remove();
        const g = this.session.undo();
        const item = this.session.peek();
        if (item && this.kind === "scheduled") this.progress.unrecord(item);
        this.layout();
        this.hud();
        const el = this.top();
        if (!el) return;
        const from = (g === "keep" ? 1 : -1) * (activeWindow.innerWidth * 0.6 + el.offsetWidth);
        el.addClass("is-live");
        this.pose(el, from, -40);
        activeWindow.requestAnimationFrame(() => this.spring(el, from, -40, 0, 0));
    }

    private flip(): void {
        const el = this.top();
        if (!el || this.busy) return;
        el.toggleClass("is-flipped", !el.hasClass("is-flipped"));
    }

    private bindDrag(el: HTMLElement): void {
        let id: number | null = null;
        let x0 = 0, y0 = 0, t0 = 0, dx = 0, dy = 0, drag = false;
        let samples: [number, number, number][] = [];

        el.addEventListener("pointerdown", (e) => {
            if (el !== this.top() || this.busy || e.button > 0) return;
            id = e.pointerId;
            x0 = e.clientX;
            y0 = e.clientY;
            t0 = performance.now();
            dx = dy = 0;
            drag = false;
            samples = [[t0, 0, 0]];
            try {
                el.setPointerCapture(id);
            } catch {
                // A pointer that already ended cannot be captured; the move handlers still see it.
            }
        });
        el.addEventListener("pointermove", (e) => {
            if (e.pointerId !== id) return;
            dx = e.clientX - x0;
            dy = e.clientY - y0;
            if (!drag) {
                if (Math.hypot(dx, dy) < 8) return;
                // On the back a vertical move scrolls a long answer instead of dragging the card.
                if (el.hasClass("is-flipped") && Math.abs(dy) > Math.abs(dx)) {
                    id = null;
                    return;
                }
                drag = true;
                el.addClass("is-live");
            }
            samples.push([performance.now(), dx, dy]);
            if (samples.length > 6) samples.shift();
            this.pose(el, dx, dy * 0.6);
        });
        const end = (e: PointerEvent): void => {
            if (e.pointerId !== id) return;
            id = null;
            if (!drag) {
                if (e.type === "pointerup" && performance.now() - t0 < 400) this.flip();
                return;
            }
            const a = samples[0] ?? [t0, 0, 0];
            const b = samples[samples.length - 1] ?? a;
            const span = Math.max(1, b[0] - a[0]);
            const vx = (b[1] - a[1]) / span;
            const vy = ((b[2] - a[2]) / span) * 0.6;
            const far = Math.abs(dx) > el.offsetWidth * THRESHOLD;
            if (e.type === "pointerup" && (far || (Math.abs(vx) > 0.55 && Math.abs(dx) > 30))) {
                this.fling((far ? dx : vx) > 0 ? 1 : -1, dx, dy * 0.6, vx, vy);
            } else {
                this.spring(el, dx, dy * 0.6, vx, vy);
            }
        };
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
    }

    private finish(): void {
        if (this.kind === "scheduled") void this.progress.save();
        const s = this.session;
        const n = s.total, keep = s.count("keep"), again = s.graded("repeat");
        const done = this.stage.createDiv({ cls: "flashy-done" });
        const ring = done.createDiv({ cls: "flashy-ring" });
        const svg = ring.createSvg("svg", { attr: { viewBox: "0 0 150 150" } });
        svg.createSvg("circle", { cls: "flashy-ring-track", attr: { cx: 75, cy: 75, r: 62 } });
        const val = svg.createSvg("circle", { cls: "flashy-ring-value", attr: { cx: 75, cy: 75, r: 62 } });
        const num = ring.createDiv({ cls: "flashy-ring-num", text: String(keep) });
        num.createEl("small", { text: this.t.of(n) });
        done.createEl("h2", { text: keep === n ? this.t.doneAll : again.length > n / 2 ? this.t.doneMost : this.t.doneSome });
        done.createEl("p", { text: again.length ? this.t.summary(keep, again.length) : this.t.summaryAll(n) });
        const acts = done.createDiv({ cls: "flashy-acts" });
        if (again.length) {
            acts.createEl("button", { cls: "mod-cta", text: this.t.repeatN(again.length) }).addEventListener("click", () => this.start(again, "practice"));
            done.createDiv({ cls: "flashy-home-note", text: this.t.practiceNote });
        }
        acts.createEl("button", { cls: again.length ? "" : "mod-cta", text: this.t.toDeck }).addEventListener("click", () => {
            this.progress.refresh();
            this.showDeck();
        });
        activeWindow.requestAnimationFrame(() =>
            activeWindow.requestAnimationFrame(() => val.setCssProps({ "--flashy-share": String(n ? keep / n : 0) })),
        );
    }
}
