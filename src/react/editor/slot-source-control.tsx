import { useState } from "react";
import { cn } from "../cn";
import type { SlotSource } from "../../stage/stage-graph";
import { useEditorEnv } from "./context";
import { ChevronDownIcon } from "./icons";
import type { EditorLookups } from "./types";

type SourceType = SlotSource["type"];

// Text shown on the slot for a source
export function useSourceLabel(lookups: EditorLookups) {
  const { labels, matchName } = useEditorEnv();
  const t = labels.source;
  return (source: SlotSource, fed = false): string => {
    if (fed) return t.fed;
    switch (source.type) {
      case "unset":
        return t.unset;
      case "bye":
        return t.bye;
      case "seed":
        return t.seedValue(source.seed);
      case "entrant":
        return lookups.entrants.find((e) => e.id === source.entrantId)?.name ?? t.entrantMissing;
      case "group_rank": {
        const group = lookups.rankSources.find((g) => g.id === source.containerId);
        return t.groupRankValue(group?.name ?? "?", source.rank);
      }
      case "match_outcome": {
        const match = lookups.outcomeSources.find((m) => m.id === source.matchId);
        const name = match ? (match.labelKey ? matchName(match.labelKey, match.labelParams ?? {}) : (match.label ?? `${match.containerName} R${match.round}`)) : "?";
        return source.outcome === "winner" ? t.winnerOf(name) : t.loserOf(name);
      }
    }
  };
}

interface Draft {
  type: SourceType;
  seed: string;
  entrantId: string;
  containerId: string;
  rank: string;
  matchId: string;
  outcome: "winner" | "loser";
}

function draftOf(source: SlotSource): Draft {
  return {
    type: source.type,
    seed: source.type === "seed" ? String(source.seed) : "",
    entrantId: source.type === "entrant" ? source.entrantId : "",
    containerId: source.type === "group_rank" ? source.containerId : "",
    rank: source.type === "group_rank" ? String(source.rank) : "",
    matchId: source.type === "match_outcome" ? source.matchId : "",
    outcome: source.type === "match_outcome" ? source.outcome : "winner",
  };
}

type DraftErrors = Partial<Record<"seed" | "entrantId" | "containerId" | "rank" | "matchId", "seed" | "entrant" | "group" | "rank" | "match">>;

// Builds the source from the draft, or the errors to show under the fields
function build(d: Draft): { source: SlotSource } | { errors: DraftErrors } {
  const whole = (v: string) => /^\d+$/.test(v.trim()) && Number(v) >= 1;
  switch (d.type) {
    case "unset":
    case "bye":
      return { source: { type: d.type } };
    case "seed":
      return whole(d.seed) ? { source: { type: "seed", seed: Number(d.seed) } } : { errors: { seed: "seed" } };
    case "entrant":
      return d.entrantId ? { source: { type: "entrant", entrantId: d.entrantId } } : { errors: { entrantId: "entrant" } };
    case "group_rank": {
      const errors: DraftErrors = {};
      if (!d.containerId) errors.containerId = "group";
      if (!whole(d.rank)) errors.rank = "rank";
      return Object.keys(errors).length > 0 ? { errors } : { source: { type: "group_rank", containerId: d.containerId, rank: Number(d.rank) } };
    }
    case "match_outcome":
      return d.matchId ? { source: { type: "match_outcome", matchId: d.matchId, outcome: d.outcome } } : { errors: { matchId: "match" } };
  }
}

export function SlotSourceControl({
  source,
  fed,
  readOnly,
  invalid,
  lookups,
  onChange,
  allowBye = true,
}: {
  source: SlotSource;
  fed: boolean;
  readOnly: boolean;
  invalid: boolean;
  lookups: EditorLookups;
  onChange: (source: SlotSource) => void;
  // A bye has no meaning for the entry slots of a Swiss group
  allowBye?: boolean;
}) {
  const { ui, labels } = useEditorEnv();
  const { Button, Input, Popover, PopoverContent, PopoverTrigger, Select } = ui;
  const t = labels.source;
  const label = useSourceLabel(lookups);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(source));
  const [errors, setErrors] = useState<DraftErrors>({});

  const text = label(source, fed);
  const tone = fed || source.type === "unset" ? "text-muted-foreground" : "text-foreground";

  if (fed || readOnly) {
    return <div className={cn("truncate rounded bg-muted px-2 py-1 text-xs", tone)}>{text}</div>;
  }

  const types: SourceType[] = allowBye ? ["unset", "bye", "seed", "entrant"] : ["unset", "seed", "entrant"];
  if (lookups.rankSources.length > 0) types.push("group_rank");
  if (lookups.outcomeSources.length > 0) types.push("match_outcome");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors({});
  };

  function apply() {
    const built = build(draft);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    onChange(built.source);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(draftOf(source));
          setErrors({});
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger
        className={cn(
          "nodrag nopan flex h-7 w-full items-center justify-between gap-1 rounded border border-input bg-transparent px-2 text-left text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px",
          invalid && "border-destructive",
          tone,
        )}
      >
        <span className="truncate">{text}</span>
        <ChevronDownIcon className="size-3.5 flex-none text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="nodrag nopan flex flex-col gap-3">
        <Field label={t.type} id="source-type">
          <Select id="source-type" value={draft.type} onValueChange={(v) => set("type", v as SourceType)} options={types.map((type) => ({ value: type, label: t.types[type] }))} />
        </Field>

        {draft.type === "seed" && (
          <Field label={t.seed} id="source-seed" error={errors.seed && t.errors[errors.seed]}>
            <Input id="source-seed" inputMode="numeric" value={draft.seed} aria-invalid={!!errors.seed} onChange={(e) => set("seed", e.target.value)} />
          </Field>
        )}
        {draft.type === "entrant" && (
          <Field label={t.entrant} id="source-entrant" error={errors.entrantId && t.errors[errors.entrantId]}>
            <Select
              id="source-entrant"
              value={draft.entrantId}
              onValueChange={(v) => set("entrantId", v)}
              options={lookups.entrants.map((e) => ({ value: e.id, label: e.seed !== null ? `#${e.seed} ${e.name}` : e.name }))}
              placeholder={t.choose}
              invalid={!!errors.entrantId}
            />
          </Field>
        )}
        {draft.type === "group_rank" && (
          <>
            <Field label={t.group} id="source-group" error={errors.containerId && t.errors[errors.containerId]}>
              <Select
                id="source-group"
                value={draft.containerId}
                onValueChange={(v) => set("containerId", v)}
                options={lookups.rankSources.map((g) => ({ value: g.id, label: `${g.stageName} / ${g.name}` }))}
                placeholder={t.choose}
                invalid={!!errors.containerId}
              />
            </Field>
            <Field label={t.rank} id="source-rank" error={errors.rank && t.errors[errors.rank]}>
              <Input id="source-rank" inputMode="numeric" value={draft.rank} aria-invalid={!!errors.rank} onChange={(e) => set("rank", e.target.value)} />
            </Field>
          </>
        )}
        {draft.type === "match_outcome" && (
          <>
            <Field label={t.match} id="source-match" error={errors.matchId && t.errors[errors.matchId]}>
              <MatchSelect lookups={lookups} value={draft.matchId} invalid={!!errors.matchId} onChange={(v) => set("matchId", v)} />
            </Field>
            <Field label={t.outcome} id="source-outcome">
              <Select
                id="source-outcome"
                value={draft.outcome}
                onValueChange={(v) => set("outcome", v as "winner" | "loser")}
                options={[
                  { value: "winner", label: t.outcomeWinner },
                  { value: "loser", label: t.outcomeLoser },
                ]}
              />
            </Field>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            {labels.apply}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MatchSelect({ lookups, value, invalid, onChange }: { lookups: EditorLookups; value: string; invalid: boolean; onChange: (v: string) => void }) {
  const { ui, labels, matchName } = useEditorEnv();
  const { Select } = ui;
  return (
    <Select
      id="source-match"
      value={value}
      onValueChange={onChange}
      options={lookups.outcomeSources.map((m) => ({
        value: m.id,
        label: `${m.stageName} / ${m.containerName} / ${m.labelKey ? matchName(m.labelKey, m.labelParams ?? {}) : (m.label ?? `R${m.round}`)}`,
      }))}
      placeholder={labels.source.choose}
      invalid={invalid}
    />
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">
        {label} <span className="text-destructive" aria-hidden="true">*</span>
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
