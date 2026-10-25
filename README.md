# @osthelia/bracket-engine

Tournament bracket engine used by GC Stats.

- **Engine** (`@osthelia/bracket-engine`): pure TypeScript, no dependency. Bracket generators, graph validation, standings, match resolution, bracket layout and stage structure validation.
- **React components** (`@osthelia/bracket-engine/react`): a read only bracket viewer and a stage structure editor, both built on [React Flow](https://reactflow.dev).

## Install

```bash
npm install @osthelia/bracket-engine
# only for the React components
npm install react @xyflow/react
```

## Engine

```ts
import { generateDoubleElimination, validateGraph, resolveMatchInGraph } from "@osthelia/bracket-engine";

const graph = generateDoubleElimination({
  upperContainerId: "upper",
  lowerContainerId: "lower",
  grandFinalContainerId: "final",
  entrantCount: 16,
  bestOf: 3,
  grandFinalBestOf: 5,
  lowerFinalBestOf: 5,
});

validateGraph(graph);
```

| Area | Exports |
|---|---|
| Model | `BracketGraph`, `MatchNode`, `BracketEdge`, `SeedSource` |
| Generators | `generateSingleElimination`, `generateDoubleElimination`, `generateTripleElimination`, `generateRoundRobin`, `generateGslGroup`, Swiss pairing (`pairRound`, `groupByRecord`, `recomputeBuchholz`) |
| Validation | `validateGraph`, `validateStageGraph` |
| Resolution | `resolveMatchInGraph` |
| Standings | `createRoundRobinStandings`, `createSwissStandings` |
| Layout | `layoutBracket` (viewer), `layoutEditorGrid`, `snapToGrid` (editor) |
| Seeding | `groupRankOrder`, `distribute`, `qualificationOrder`, `shuffle` |

Every format option that takes a best of (`bestOf`, `finalBestOf`, `grandFinalBestOf`, `lowerFinalBestOf`) defaults to `bestOf`.

## React components

The components are styled with Tailwind CSS classes and the shadcn design tokens (`background`, `card`, `border`, `primary`, `muted`, `destructive`, `ring`) plus two extra tokens, `subtle-foreground` and `status-live`. Tell Tailwind to scan the package so the classes are generated:

```css
@source "../node_modules/@osthelia/bracket-engine/dist";
```

The package imports `@xyflow/react/dist/style.css`, so your bundler must accept CSS imports from `node_modules` (Next.js does).

### Viewer

```tsx
import { BracketCanvas } from "@osthelia/bracket-engine/react";

<BracketCanvas
  containers={containers}
  matchHref={(id) => `/match/${id}`}
  labels={{ viewer: { tbd: "A définir" } }}
  renderLink={({ href, className, children }) => <Link href={href} className={className}>{children}</Link>}
  renderLogo={(entrant, className) => <TeamLogo team={entrant} className={className} />}
/>
```

`renderLink` and `renderLogo` are optional. The default logo shows the first letter of the name when there is no image or the image fails to load.

The canvas is heavy, load it on demand in your app (`next/dynamic` with `ssr: false`, or `React.lazy`).

### Editor

The editor does not ship form controls. Pass the ones of your design system with `ui`:

```tsx
import { StageEditor } from "@osthelia/bracket-engine/react";

<StageEditor
  data={editorData}
  ui={{ Button, Input, Select, Checkbox, Popover, PopoverTrigger, PopoverContent, ConfirmDialog, Spinner }}
  onSave={async (graph) => saveStage(stageId, graph)}
  onSaved={() => router.refresh()}
  errorMessage={(error) => t(error.code, error.params)}
/>
```

`onSave` must validate again on the server and return `{ ok: false, errors }` keyed by field path when it refuses the graph. The prop shapes each control must accept are described by the `EditorUi` type.

### Translations

Every text can be replaced through the `labels` prop, anything missing stays in English. Labels that take a value are functions (`errorCount: (count) => ...`), so plural rules stay yours.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Release

Releases are manual. Update `CHANGELOG.md`, bump the version, then:

```bash
npm version <patch|minor|major>
npm publish --access public
```

`prepack` builds the package, `files` limits the tarball to `dist`, the license and the docs. Run `npm pack --dry-run` first to check the content.

## License

Osthelia License v1.0, see `LICENSE.md`. The copyright headers of the source files must be kept.
