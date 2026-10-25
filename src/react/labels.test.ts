import { describe, expect, it } from "vitest";
import { defaultLabels, resolveLabels } from "./labels";

describe("resolveLabels", () => {
  it("returns the English defaults without a patch", () => {
    expect(resolveLabels()).toEqual(defaultLabels);
  });

  it("overrides a nested text and keeps the others", () => {
    const labels = resolveLabels({ editor: { source: { bye: "Exempt" } }, viewer: { tbd: "A définir" } });
    expect(labels.editor.source.bye).toBe("Exempt");
    expect(labels.editor.source.unset).toBe(defaultLabels.editor.source.unset);
    expect(labels.viewer.tbd).toBe("A définir");
  });

  it("replaces a function label", () => {
    const labels = resolveLabels({ viewer: { qualifiedWinner: (d) => `Vers ${d}` } });
    expect(labels.viewer.qualifiedWinner("Playoffs")).toBe("Vers Playoffs");
  });

  it("names generated matches in English", () => {
    expect(defaultLabels.viewer.matchName("upperRound", { round: 2 })).toBe("Upper Round 2");
    expect(defaultLabels.viewer.matchName("grandFinal", {})).toBe("Grand Final");
  });
});
