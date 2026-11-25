import { type App, Component, MarkdownRenderer, Modal, Notice, setIcon } from "obsidian";
import type { DeckCard, DeckProgress } from "../app/progress";
import { buildMatch, formatTime, isNewBest, tap, type Tile } from "../core/match";
import { buildQuiz, type Question } from "../core/quiz";
import { answerAsFront, answerFirst, pickVoice, SIDES, type Side, speechLang, speechLocale, speechText } from "../core/side";
import { type Grade, Session, shuffle } from "../core/session";
import { language, type Strings, strings } from "../i18n";

const STACK = 3;
/** Questions in one quiz round. */
const QUIZ_SIZE = 20;
/** After a right answer the next question comes on its own after this long. */
const QUIZ_NEXT_MS = 750;
/** A wrong pair stays red this long. */
const MATCH_MISS_MS = 450;
/** A term with a word longer than this gets the smaller font on a tile. */
const LONG_WORD = 10;
/** How often the match clock redraws. */
const MATCH_TICK_MS = 100;
/** Share of the card width a drag must pass to count as a grade. */
const THRESHOLD = 0.32;
/** Spring constants per millisecond: about a 0.4 s period, a little overshoot. */
const SPRING_K = 0.00026;
const SPRING_C = 0.019;

/** A scheduled round writes every grade to the log; a practice round (the cards sent left, again) writes nothing. */
type RoundKind = "scheduled" | "practice";

/** Choices the plugin keeps for every review: the side a card shows first. */
export interface ReviewPrefs {
    side(): Side;
    setSide(side: Side): Promise<void>;
}

/** What text-to-speech reads on each face of a card, and in which language. */
interface Speech {
    front: [string, string];
    back: [string, string];
}

export class ReviewModal extends Modal {
    /** Called once the reviews of this modal are written, so a deck list can redraw with the new numbers. */
    onClosed?: () => void;
    private session: Session<DeckCard> = new Session<DeckCard>([]);
    private kind: RoundKind = "scheduled";
    private shuffled = false;
    private busy = false;
    /** The grade of a card in flight, written on close if the modal shuts before the card leaves the screen. */
    private flying: Grade | null = null;
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
    private quiz: { questions: Question<DeckCard>[]; reverse: boolean; index: number; right: number; wrong: DeckCard[]; answered: boolean } | null = null;
    private quizTimer: number | null = null;
    private match: { tiles: Tile<DeckCard>[]; buttons: HTMLButtonElement[]; selected: number | null; matched: number; misses: number; started: number } | null = null;
    private matchClock: number | null = null;
    private legend!: HTMLElement;
    /** Cards of this round that show their answer first (all of them, none, or a coin per card). */
    private answerFirst = new Set<DeckCard>();
    private readonly speech = new WeakMap<HTMLElement, Speech>();
    private readonly synth: SpeechSynthesis | null = "speechSynthesis" in activeWindow ? activeWindow.speechSynthesis : null;

    constructor(
        app: App,
        private readonly progress: DeckProgress,
        private readonly prefs: ReviewPrefs,
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
        const inCards = (): boolean => inRound() && !this.quiz && !this.match;
        this.scope.register([], "ArrowRight", () => (inCards() && this.fling(1), false));
        this.scope.register([], "ArrowLeft", () => (inCards() && this.fling(-1), false));
        this.scope.register([], " ", () => (inCards() && this.flip(), false));
        this.scope.register([], "ArrowUp", () => (inCards() && this.flip(), false));
        this.scope.register([], "ArrowDown", () => (inCards() && this.flip(), false));
        this.scope.register([], "s", () => (inCards() && this.speakTop(), false));
        this.scope.register([], "Backspace", () => (inCards() && this.undo(), false));
        for (const n of ["1", "2", "3", "4"]) this.scope.register([], n, () => (this.quiz && this.pick(Number(n) - 1), false));
        this.scope.register([], "Enter", () => (this.quiz?.answered && this.nextQuestion(), false));
        this.showDeck();
    }

    onClose(): void {
        this.synth?.cancel();
        if (this.quizTimer !== null) window.clearTimeout(this.quizTimer);
        this.stopMatchClock();
        const item = this.session.peek();
        if (this.flying && item && this.kind === "scheduled") this.progress.record(item, this.flying);
        this.flying = null;
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
        for (const el of Array.from(this.stage.querySelectorAll(".flashy-card, .flashy-done, .flashy-home, .flashy-quiz, .flashy-match"))) el.remove();
        this.nodes.clear();
        if (this.quizTimer !== null) window.clearTimeout(this.quizTimer);
        this.quizTimer = null;
        this.quiz = null;
        this.root.removeClass("is-quiz");
        this.stopMatchClock();
        this.match = null;
        this.root.removeClass("is-match");
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

        // The ways through a deck, side by side as Quizlet shows them: every card, a quiz, a reverse quiz.
        const modes = home.createDiv({ cls: "flashy-modes" });
        const mode = (icon: string, label: string, n: number, aria: string, run: () => void): void => {
            const b = modes.createEl("button", { cls: "flashy-mode", attr: { "aria-label": aria } });
            setIcon(b.createSpan({ cls: "flashy-mode-icon" }), icon);
            b.createSpan({ cls: "flashy-mode-label", text: label });
            b.createSpan({ cls: "flashy-mode-n", text: String(n) });
            b.addEventListener("click", run);
        };
        mode("layers", this.t.modeCards, s.total, this.t.practiceAll(s.total), () => this.start(this.progress.items, "scheduled"));
        const quiz = this.makeQuiz(this.progress.items, false);
        if (quiz.length) mode("list-checks", this.t.modeQuiz, quiz.length, this.t.quizStart(quiz.length), () => this.startQuiz(quiz, false));
        const reverse = quiz.length ? this.makeQuiz(this.progress.items, true) : [];
        if (reverse.length)
            mode("arrow-left-right", this.t.modeReverse, reverse.length, this.t.quizReverseStart(reverse.length), () => this.startQuiz(reverse, true));
        const pairs = this.newMatch().length / 2;
        if (pairs) mode("layout-grid", this.t.modeMatch, pairs, this.t.matchStart(pairs), () => this.startMatch());

        // The side a card shows first, for studying and for going through every card.
        const side = home.createDiv({ cls: "flashy-side" });
        side.createSpan({ cls: "flashy-side-label", text: this.t.side });
        const seg = side.createDiv({ cls: "flashy-seg", attr: { role: "radiogroup", "aria-label": this.t.side } });
        const labels: Record<Side, string> = { term: this.t.sideTerm, definition: this.t.sideDefinition, mixed: this.t.sideMixed };
        const pills = SIDES.map((value) => {
            const b = seg.createEl("button", { text: labels[value], attr: { role: "radio" } });
            b.addEventListener("click", () => {
                void this.prefs.setSide(value);
                mark();
            });
            return [value, b] as const;
        });
        const mark = (): void => {
            for (const [value, b] of pills) {
                b.toggleClass("is-active", value === this.prefs.side());
                b.setAttr("aria-checked", String(value === this.prefs.side()));
            }
        };
        mark();
        const next = this.progress.nextDue();
        if (!today.length && next) home.createDiv({ cls: "flashy-home-note", text: this.t.nextOn(next.toLocaleDateString(language(), { day: "numeric", month: "long" })) });
    }

    // ---------- quiz ----------

    /** Questions about `ask`, with wrong options drawn from every card of this review. */
    private makeQuiz(ask: readonly DeckCard[], reverse: boolean): Question<DeckCard>[] {
        const all = buildQuiz(this.progress.items, (c) => c.card.front, (c) => c.card.back, Number.POSITIVE_INFINITY, { reverse });
        const wanted = new Set(ask);
        const asked = all.filter((q) => wanted.has(q.item));
        return asked.slice(0, QUIZ_SIZE);
    }

    private startQuiz(questions: Question<DeckCard>[], reverse: boolean): void {
        this.clearStage();
        this.root.addClass("is-round");
        this.root.addClass("is-quiz");
        this.quiz = { questions, reverse, index: 0, right: 0, wrong: [], answered: false };
        this.showQuestion();
    }

    private quizHud(): void {
        const q = this.quiz;
        if (!q) return;
        const n = q.questions.length;
        this.countEl.setText(`${Math.min(q.index + 1, n)} / ${n}`);
        this.barEl.setCssProps({ "--flashy-progress": `${n ? (q.index / n) * 100 : 0}%` });
        this.repeatEl.querySelector(".flashy-n")?.setText(String(q.wrong.length));
        this.keepEl.querySelector(".flashy-n")?.setText(String(q.right));
    }

    private showQuestion(): void {
        const q = this.quiz;
        if (!q) return;
        this.stage.querySelector(".flashy-quiz")?.remove();
        this.quizHud();
        const question = q.questions[q.index];
        if (!question) return this.finishQuiz();
        q.answered = false;
        const view = this.stage.createDiv({ cls: q.reverse ? "flashy-quiz is-reverse" : "flashy-quiz" });
        const prompt = view.createDiv({ cls: "flashy-quiz-prompt" });
        prompt.createDiv({ cls: "flashy-deck", text: `${question.item.deck} · ${q.reverse ? this.t.quizAskReverse : this.t.quizAsk}` });
        void MarkdownRenderer.render(this.app, question.prompt, prompt.createDiv({ cls: "flashy-quiz-text markdown-rendered" }), question.item.path, this.md);
        const list = view.createDiv({ cls: "flashy-quiz-options" });
        question.labels.forEach((label, i) => {
            const b = list.createEl("button", { cls: "flashy-quiz-option" });
            b.createSpan({ cls: "flashy-quiz-key", text: String(i + 1) });
            b.createSpan({ cls: "flashy-quiz-label", text: label });
            b.addEventListener("click", () => this.pick(i));
        });
        const next = view.createEl("button", { cls: "mod-cta flashy-quiz-next is-hidden", text: this.t.quizNext });
        next.addEventListener("click", () => this.nextQuestion());
    }

    private pick(i: number): void {
        const q = this.quiz;
        const question = q?.questions[q.index];
        if (!q || !question || q.answered || i >= question.options.length) return;
        q.answered = true;
        const buttons = Array.from(this.stage.querySelectorAll<HTMLButtonElement>(".flashy-quiz-option"));
        buttons.forEach((b) => (b.disabled = true));
        buttons[question.answer]?.addClass("is-right");
        if (i === question.answer) {
            q.right++;
            this.bump(this.keepEl);
            this.quizTimer = window.setTimeout(() => this.nextQuestion(), this.reduceMotion ? 0 : QUIZ_NEXT_MS);
        } else {
            q.wrong.push(question.item);
            buttons[i]?.addClass("is-wrong");
            this.bump(this.repeatEl);
            this.stage.querySelector(".flashy-quiz-next")?.removeClass("is-hidden");
        }
        this.quizHud();
    }

    private nextQuestion(): void {
        const q = this.quiz;
        if (!q || !q.answered) return;
        if (this.quizTimer !== null) window.clearTimeout(this.quizTimer);
        this.quizTimer = null;
        q.index++;
        this.showQuestion();
    }

    private finishQuiz(): void {
        const q = this.quiz;
        if (!q) return;
        const n = q.questions.length;
        const wrong = q.wrong.slice();
        const done = this.stage.createDiv({ cls: "flashy-done" });
        const ring = done.createDiv({ cls: "flashy-ring" });
        const svg = ring.createSvg("svg", { attr: { viewBox: "0 0 150 150" } });
        svg.createSvg("circle", { cls: "flashy-ring-track", attr: { cx: 75, cy: 75, r: 62 } });
        const val = svg.createSvg("circle", { cls: "flashy-ring-value", attr: { cx: 75, cy: 75, r: 62 } });
        ring.createDiv({ cls: "flashy-ring-num", text: String(q.right) }).createEl("small", { text: this.t.of(n) });
        done.createEl("h2", { text: wrong.length ? this.t.quizScore(q.right, n) : this.t.quizPerfect });
        done.createDiv({ cls: "flashy-home-note", text: this.t.quizNote });
        const acts = done.createDiv({ cls: "flashy-acts" });
        if (wrong.length) {
            const reverse = q.reverse;
            const again = this.makeQuiz(wrong, reverse);
            if (again.length)
                acts.createEl("button", { cls: "mod-cta", text: this.t.quizRetry(again.length) }).addEventListener("click", () => this.startQuiz(again, reverse));
        }
        acts.createEl("button", { cls: wrong.length ? "" : "mod-cta", text: this.t.toDeck }).addEventListener("click", () => this.showDeck());
        window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => val.setCssProps({ "--flashy-share": String(n ? q.right / n : 0) })),
        );
    }

    // ---------- match ----------

    /** A fresh game: up to six random cards of this review, as shuffled term and definition tiles. */
    private newMatch(): Tile<DeckCard>[] {
        return buildMatch(this.progress.items, (c) => c.card.front, (c) => c.card.back);
    }

    private startMatch(): void {
        const tiles = this.newMatch();
        if (!tiles.length) return this.showDeck();
        this.clearStage();
        this.root.addClass("is-round");
        this.root.addClass("is-match");
        const view = this.stage.createDiv({ cls: "flashy-match" });
        view.createDiv({ cls: "flashy-deck flashy-match-hint", text: this.t.matchHint });
        const grid = view.createDiv({ cls: "flashy-match-grid" });
        const buttons = tiles.map((tile, i) => {
            // A term with a long word gets a smaller font so the word stays whole on a phone.
            const long = tile.side === "term" && tile.label.split(/\s+/).some((w) => w.length > LONG_WORD);
            const b = grid.createEl("button", { cls: `flashy-match-tile is-${tile.side}${long ? " is-long" : ""}` });
            // A span, not bare text: a flex item would not wrap a long word.
            b.createSpan({ cls: "flashy-match-label", text: tile.label });
            b.addEventListener("click", () => this.tapTile(i));
            return b;
        });
        this.match = { tiles, buttons, selected: null, matched: 0, misses: 0, started: performance.now() };
        this.matchHud();
        this.matchClock = window.setInterval(() => this.matchHud(), MATCH_TICK_MS);
    }

    private stopMatchClock(): void {
        if (this.matchClock !== null) window.clearInterval(this.matchClock);
        this.matchClock = null;
    }

    /** The clock in the middle, matched pairs on the right, misses on the left. */
    private matchHud(): void {
        const m = this.match;
        if (!m) return;
        const pairs = m.tiles.length / 2;
        this.countEl.setText(this.t.matchTime(formatTime(performance.now() - m.started)));
        this.barEl.setCssProps({ "--flashy-progress": `${(m.matched / pairs) * 100}%` });
        this.repeatEl.querySelector(".flashy-n")?.setText(String(m.misses));
        this.keepEl.querySelector(".flashy-n")?.setText(String(m.matched));
    }

    private tapTile(i: number): void {
        const m = this.match;
        const b = m?.buttons[i];
        if (!m || !b || b.hasClass("is-matched")) return;
        const prev = m.selected === null ? undefined : m.buttons[m.selected];
        const result = tap(m.tiles, m.selected, i);
        prev?.removeClass("is-selected");
        if (result === "select") {
            b.addClass("is-selected");
            m.selected = i;
            return;
        }
        m.selected = null;
        if (result === "deselect" || !prev) return;
        if (result === "match") {
            for (const el of [prev, b]) {
                el.addClass("is-matched");
                el.disabled = true;
            }
            m.matched++;
            this.bump(this.keepEl);
        } else {
            for (const el of [prev, b]) {
                el.removeClass("is-wrong");
                void el.offsetWidth;
                el.addClass("is-wrong");
            }
            window.setTimeout(() => [prev, b].forEach((el) => el.removeClass("is-wrong")), this.reduceMotion ? 0 : MATCH_MISS_MS);
            m.misses++;
            this.bump(this.repeatEl);
        }
        this.matchHud();
        if (m.matched === m.tiles.length / 2) this.finishMatch();
    }

    private finishMatch(): void {
        const m = this.match;
        if (!m) return;
        this.stopMatchClock();
        const ms = performance.now() - m.started;
        this.countEl.setText(this.t.matchTime(formatTime(ms)));
        const best = this.progress.matchBest();
        const isNew = this.progress.hasMatchDeck() && isNewBest(best, ms);
        this.stage.querySelector(".flashy-match")?.remove();
        const done = this.stage.createDiv({ cls: "flashy-done" });
        done.createDiv({ cls: "flashy-match-time", text: this.t.matchTime(formatTime(ms)) });
        done.createEl("h2", { text: isNew ? this.t.matchNewBest : this.t.matchDone });
        const line = [this.t.matchMisses(m.misses)];
        if (!isNew && best !== undefined) line.push(this.t.matchBest(best.toFixed(1)));
        done.createEl("p", { cls: "flashy-match-summary", text: line.join(" · ") });
        done.createDiv({ cls: "flashy-home-note", text: this.t.matchNote });
        const acts = done.createDiv({ cls: "flashy-acts" });
        acts.createEl("button", { cls: "mod-cta", text: this.t.matchAgain }).addEventListener("click", () => this.startMatch());
        acts.createEl("button", { text: this.t.toDeck }).addEventListener("click", () => this.showDeck());
        if (isNew) {
            this.progress.finishMatch(ms).catch((e: unknown) => {
                console.error("Flashy: saving the match best time failed", e);
                new Notice(this.t.matchSaveFailed(e instanceof Error ? e.message : String(e)));
            });
        }
    }

    // ---------- round ----------

    private start(cards: readonly DeckCard[], kind: RoundKind): void {
        this.clearStage();
        this.kind = kind;
        this.root.addClass("is-round");
        this.root.toggleClass("is-practice", kind === "practice");
        this.session = new Session(this.shuffled ? shuffle(cards) : cards.slice());
        const side = this.prefs.side();
        this.answerFirst = new Set(this.session.items.filter(() => answerFirst(side)));
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
        const { front: term, back: answer } = item.card;
        const flipped = this.answerFirst.has(item);
        const el = createDiv({ cls: flipped ? "flashy-card is-answer-first" : "flashy-card" });
        const flipper = el.createDiv({ cls: "flashy-flipper" });
        const front = flipper.createDiv({ cls: "flashy-face flashy-front" });
        front.createDiv({ cls: "flashy-deck", text: item.deck });
        const back = flipper.createDiv({ cls: "flashy-face flashy-back" });
        const scroll = back.createDiv({ cls: "flashy-scroll markdown-rendered" });
        if (this.synth) scroll.createDiv({ cls: "flashy-speak-gap" });
        if (flipped) {
            // The answer asks, with the term hidden in it; the back names the term above the whole answer.
            const prompt = answerAsFront(term, answer);
            void MarkdownRenderer.render(this.app, prompt, front.createDiv({ cls: "flashy-prompt markdown-rendered" }), item.path, this.md);
            void MarkdownRenderer.render(this.app, term, scroll.createDiv({ cls: "flashy-answer-term" }), item.path, this.md);
            void MarkdownRenderer.render(this.app, answer, scroll.createDiv(), item.path, this.md);
            const asked = speechText(prompt, false).replace(/_{3,}/g, "…");
            this.speech.set(el, { front: [asked, speechLang(asked)], back: [speechText(term, true), speechLang(term, item.lang)] });
        } else {
            void MarkdownRenderer.render(this.app, term, front.createDiv({ cls: "flashy-term markdown-rendered" }), item.path, this.md);
            void MarkdownRenderer.render(this.app, answer, scroll, item.path, this.md);
            const said = speechText(answer, false);
            this.speech.set(el, { front: [speechText(term, true), speechLang(term, item.lang)], back: [said, speechLang(said)] });
        }
        front.createDiv({ cls: "flashy-hint", text: this.t.tapHint });
        if (this.synth) {
            for (const [face, which] of [[front, "front"], [back, "back"]] as const) {
                const b = face.createEl("button", { cls: "flashy-speak clickable-icon", attr: { "aria-label": this.t.speak } });
                setIcon(b, "volume-2");
                b.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.speak(el, which);
                });
            }
        }
        el.createDiv({ cls: "flashy-glow" });
        el.createDiv({ cls: "flashy-stamp is-keep", text: this.t.keep });
        el.createDiv({ cls: "flashy-stamp is-repeat", text: this.t.repeat });
        this.bindDrag(el);
        return el;
    }

    /** Reads one face of a card in its language, with a voice of that language when the system has one. */
    private speak(el: HTMLElement, face: "front" | "back"): void {
        const said = this.speech.get(el)?.[face];
        if (!this.synth || !said?.[0]) return;
        const [text, lang] = said;
        const synth = this.synth;
        // iOS drops an utterance queued right after cancel(), so cancel only what is still talking.
        if (synth.speaking || synth.pending) synth.cancel();
        const tag = speechLocale(lang);
        const u = new SpeechSynthesisUtterance(text);
        u.lang = tag;
        const voice = pickVoice(synth.getVoices(), tag);
        if (voice) u.voice = voice;
        let started = false;
        u.onstart = (): void => void (started = true);
        u.onerror = (e): void => {
            started = true;
            if (e.error !== "interrupted" && e.error !== "canceled") new Notice(this.t.speakFailed(tag, e.error));
        };
        synth.speak(u);
        // A voice that never starts says nothing at all; tell the reader instead of leaving a dead button.
        window.setTimeout(() => {
            if (!started && !synth.speaking) new Notice(this.t.speakSilent(tag));
        }, 2500);
    }

    private speakTop(): void {
        const el = this.top();
        if (el) this.speak(el, el.hasClass("is-flipped") ? "back" : "front");
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
            window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    private fling(dir: 1 | -1, x = 0, y = 0, vx = 0, vy = -0.15): void {
        const el = this.top();
        if (!el || this.busy) return;
        this.busy = true;
        this.flying = dir > 0 ? "keep" : "repeat";
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
            if (!this.flying) return;
            if (Math.abs(x) > limit) return this.commit(dir > 0 ? "keep" : "repeat");
            window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    private commit(g: Grade): void {
        this.flying = null;
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
        window.requestAnimationFrame(() => this.spring(el, from, -40, 0, 0));
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
            // The speaker is a button on the card, not a tap that flips it.
            if ((e.target as Node | null)?.instanceOf(Element) && (e.target as Element).closest(".flashy-speak")) return;
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
        window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => val.setCssProps({ "--flashy-share": String(n ? keep / n : 0) })),
        );
    }
}
