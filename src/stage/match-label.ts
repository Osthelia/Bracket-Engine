// Generated match names are stored as a message key and params, translated when displayed.
// A name typed by the organizer stays in the plain `label` column.

export type BracketTier = "solo" | "upper" | "middle" | "lower";

export interface MatchLabelKey {
  labelKey: string;
  labelParams: Record<string, number>;
}

const TIER_PREFIX: Record<BracketTier, string> = { solo: "", upper: "upper", middle: "middle", lower: "lower" };

const GENERATOR_LABELS: Record<string, string> = {
  "Grand Final": "grandFinal",
  "Final 1": "final1",
  "Final 2": "final2",
  "Opener A": "openerA",
  "Opener B": "openerB",
  "Winners Match": "winnersMatch",
  "Elimination Match": "eliminationMatch",
  Decider: "decider",
};

// Key of a fixed name given by a generator, null for a name that is not one of them
export function generatorLabelKey(label: string | undefined): MatchLabelKey | null {
  const key = label ? GENERATOR_LABELS[label] : undefined;
  return key ? { labelKey: key, labelParams: {} } : null;
}

// Round names of an elimination tier: Upper Round 2, Upper Semifinals, Upper Final...
// Only the upper tier has semifinals, the drop rounds of the others do not map to one.
export function tierRoundLabel(tier: BracketTier, round: number, totalRounds: number): MatchLabelKey {
  const prefix = TIER_PREFIX[tier];
  const name = (suffix: string) => (prefix ? `${prefix}${suffix}` : suffix.charAt(0).toLowerCase() + suffix.slice(1));
  if (round === totalRounds) return { labelKey: name("Final"), labelParams: {} };
  if (tier === "upper" && totalRounds >= 2 && round === totalRounds - 1) return { labelKey: name("Semifinals"), labelParams: {} };
  return { labelKey: name("Round"), labelParams: { round } };
}
