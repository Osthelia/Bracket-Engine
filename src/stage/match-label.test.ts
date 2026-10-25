import { describe, expect, it } from "vitest";
import { generatorLabelKey, tierRoundLabel } from "./match-label";

describe("tierRoundLabel", () => {
  it("names rounds, semifinals and final of the upper tier", () => {
    expect(tierRoundLabel("upper", 1, 4)).toEqual({ labelKey: "upperRound", labelParams: { round: 1 } });
    expect(tierRoundLabel("upper", 3, 4)).toEqual({ labelKey: "upperSemifinals", labelParams: {} });
    expect(tierRoundLabel("upper", 4, 4)).toEqual({ labelKey: "upperFinal", labelParams: {} });
  });

  it("has no semifinals outside the upper tier", () => {
    expect(tierRoundLabel("lower", 3, 4).labelKey).toBe("lowerRound");
    expect(tierRoundLabel("middle", 2, 2).labelKey).toBe("middleFinal");
  });

  it("uses unprefixed names for a single bracket", () => {
    expect(tierRoundLabel("solo", 2, 3)).toEqual({ labelKey: "round", labelParams: { round: 2 } });
    expect(tierRoundLabel("solo", 3, 3).labelKey).toBe("final");
  });
});

describe("generatorLabelKey", () => {
  it("maps fixed generator names and ignores others", () => {
    expect(generatorLabelKey("Grand Final")?.labelKey).toBe("grandFinal");
    expect(generatorLabelKey("My custom name")).toBeNull();
    expect(generatorLabelKey(undefined)).toBeNull();
  });
});
