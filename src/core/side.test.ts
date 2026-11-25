import { describe, expect, it } from "vitest";
import { answerAsFront, answerFirst, isSide, speechLang, speechText } from "./side";

describe("side", () => {
    it("knows the three sides", () => {
        expect(isSide("term")).toBe(true);
        expect(isSide("mixed")).toBe(true);
        expect(isSide("back")).toBe(false);
        expect(isSide(undefined)).toBe(false);
    });

    it("puts the answer first for definition, never for term, by coin for mixed", () => {
        expect(answerFirst("term", () => 0)).toBe(false);
        expect(answerFirst("definition", () => 0.9)).toBe(true);
        expect(answerFirst("mixed", () => 0.2)).toBe(true);
        expect(answerFirst("mixed", () => 0.7)).toBe(false);
    });

    it("hides the term in an answer shown first", () => {
        expect(answerAsFront("Blanch", "To blanch is to plunge vegetables into boiling water.")).toBe("To ___ is to plunge vegetables into boiling water.");
        expect(answerAsFront("Mexico", "Mexico City")).toBe("Mexico City");
    });
});

describe("speech", () => {
    it("reads a term as plain text and an answer by its first plain paragraph", () => {
        expect(speechText("**la cuchara**", true)).toBe("la cuchara");
        expect(speechText("`stop_reason`", true)).toBe("stop_reason");
        expect(speechText("> [!tip] skip\n> me\n\nThe *control* centre of the `cell`.\n\nMore.", false)).toBe("The control centre of the cell.");
        expect(speechText("spoon\n*Pásame la cuchara.*", false)).toBe("spoon Pásame la cuchara.");
    });

    it("takes the declared language, else guesses from the script", () => {
        expect(speechLang("la cuchara", "es")).toBe("es");
        expect(speechLang("la cuchara", " ")).toBe("en");
        expect(speechLang("Ядро клетки")).toBe("ru");
        expect(speechLang("Nucleus")).toBe("en");
    });
});
