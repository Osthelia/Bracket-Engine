# Changelog

## 1.1.1

- Swiss and round robin tiebreakers accept `map_diff` (maps won minus maps lost), read from the new optional `mapDiff` of standings and Swiss pairing entries.

## 1.1.0

- Sets: `buildTree`, `subtreeOf`, `setChain`, `checkMove`, `placeAmongSiblings`, `aggregateStatus` and `resolveStatuses` handle containers nested in a set. Stages without sets are unchanged.

## 1.0.0

First standalone release, extracted from the GC Stats repositories.

### Engine
- Generators: single, double and triple elimination, round robin, GSL group, Swiss pairing.
- `finalBestOf` (single elimination) and `lowerFinalBestOf` (double and triple elimination) set the best of of the last match of a bracket.
- Swiss and round robin tiebreakers accept `points` (hidden points of the group).
- Graph validation, match resolution, standings, bracket layout.
- Stage structure validation (`validateStageGraph`), editor grid layout, seeding and distribution helpers, generated match label keys.

### React (`@osthelia/bracket-engine/react`)
- `BracketCanvas`: read only bracket viewer with lanes, elbow links, qualifier nodes and touch support.
- `StageEditor`: structure editor, form controls and texts are provided by the host.
- `labels` prop on both, English by default.
