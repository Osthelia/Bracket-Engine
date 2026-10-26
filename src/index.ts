/**
 * GC-Stats — Tournament bracket engine
 *
 * Generates and validates bracket formats (single/double/triple elimination,
 * round-robin, GSL, Swiss), computes standings, and resolves match outcomes.
 *
 * @copyright Copyright (c) 2026 Osthelia — Bracket-Engine
 * @license   https://github.com/Osthelia/Bracket-Engine/blob/main/LICENSE.md MIT
 * @link      https://github.com/Osthelia/Bracket-Engine
 */

export * from "./graph/types";
export * from "./graph/validate";
export * from "./graph/seed-order";
export * from "./generators/single-elimination";
export * from "./generators/double-elimination";
export * from "./generators/triple-elimination";
export * from "./generators/cascade";
export * from "./generators/round-robin";
export * from "./generators/gsl-group";
export * from "./generators/swiss-pairing-engine";
export * from "./standings/types";
export * from "./standings/round-robin";
export * from "./standings/swiss";
export * from "./resolution/resolve-match";
export * from "./core/result";
export * from "./layout/bracket-layout";
export * from "./layout/editor-layout";
export * from "./stage/stage-graph";
export * from "./stage/seeding";
export * from "./stage/match-label";
export * from "./stage/editor-types";
export * from "./view/bracket-view";
export * from "./stage/set-tree";
