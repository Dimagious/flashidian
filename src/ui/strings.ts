import { getLanguage } from "obsidian";

const en = {
    keep: "Got it",
    repeat: "Again",
    answer: "Answer",
    undo: "Undo last card",
    shuffle: "Shuffle",
    close: "Close",
    tapHint: "Tap to flip",
    swipeLeft: "Swipe left",
    swipeRight: "Swipe right",
    tapCard: "Tap the card to flip",
    doneAll: "Every card is a keeper",
    doneMost: "More than half to repeat",
    doneSome: "Round complete",
    summary: (keep: number, repeat: number): string => `Kept ${keep}, ${repeat} to repeat. Run them again while they are fresh.`,
    summaryAll: (n: number): string => `All ${n} cards kept.`,
    repeatN: (n: number): string => `Repeat ${n}`,
    restart: "Start the deck over",
    of: (n: number): string => `of ${n}`,
    noCards: "No flashcards found here. A card is a paragraph, a line with only ?, and the answer below it.",
    cmdNote: "Review cards in the current note",
    cmdFolder: "Review cards in a folder",
    pickFolder: "Folder with flashcards",
    menuFolder: "Review cards with Flashy",
};

export type Strings = typeof en;

const ru: Strings = {
    keep: "Запомнил",
    repeat: "Повторить",
    answer: "Ответ",
    undo: "Вернуть прошлую карточку",
    shuffle: "Перемешать",
    close: "Закрыть",
    tapHint: "нажми, чтобы перевернуть",
    swipeLeft: "свайп влево",
    swipeRight: "свайп вправо",
    tapCard: "тап по карточке: ответ",
    doneAll: "Колода пройдена целиком",
    doneMost: "Больше половины на повтор",
    doneSome: "Круг пройден",
    summary: (keep, repeat) => `Запомнил ${keep}, на повтор ${repeat}. Прогони их ещё раз, пока свежо.`,
    summaryAll: (n) => `Все ${n} карточек на «запомнил».`,
    repeatN: (n) => `Повторить ${n}`,
    restart: "Пройти колоду заново",
    of: (n) => `из ${n}`,
    noCards: "Карточек не нашлось. Карточка это абзац, строка с одним ? и ответ под ней.",
    cmdNote: "Повторить карточки из текущей заметки",
    cmdFolder: "Повторить карточки из папки",
    pickFolder: "Папка с карточками",
    menuFolder: "Повторить карточки во Flashy",
};

export function strings(): Strings {
    return getLanguage().startsWith("ru") ? ru : en;
}
