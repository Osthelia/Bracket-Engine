import { describe, expect, it } from "vitest";
import { layoutEditorGrid, rowIndexFromY, snapToGrid } from "./editor-layout";

const opts = { columnWidth: 300, rowHeight: 140, laneGap: 80, headerHeight: 80 };

describe("editor grid", () => {
  it("puts rounds in columns and fills free rows, an explicit row wins", () => {
    const layout = layoutEditorGrid(
      [
        { id: "a", containerId: "u", round: 1 },
        { id: "b", containerId: "u", round: 1, displayOrder: 0 },
        { id: "c", containerId: "u", round: 2 },
      ],
      ["u"],
      opts,
    );
    expect(layout.positions.get("b")).toEqual({ x: 0, y: 80 });
    expect(layout.positions.get("a")).toEqual({ x: 0, y: 80 + 140 });
    expect(layout.positions.get("c")).toEqual({ x: 300, y: 80 });
    expect(layout.roundsByContainer.get("u")).toEqual([1, 2]);
  });

  it("stacks the lanes in container order", () => {
    const layout = layoutEditorGrid([{ id: "a", containerId: "u", round: 1 }, { id: "l", containerId: "l", round: 1 }], ["u", "l"], opts);
    expect(layout.laneOffsetY.get("l")).toBe(80 + 140 + 80);
    expect(layout.positions.get("l")!.y).toBe(layout.laneOffsetY.get("l")! + 80);
  });

  it("snaps a dropped position back to a round and a row", () => {
    const layout = layoutEditorGrid([{ id: "a", containerId: "u", round: 1 }], ["u"], opts);
    expect(snapToGrid(610, 80 + 300, "u", layout, opts)).toEqual({ x: 600, y: 80 + 280, round: 3 });
    expect(rowIndexFromY(-50, "u", layout, opts)).toBe(0);
  });
});
