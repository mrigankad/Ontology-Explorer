# Wayam Ontology Explorer

Explore Wayam's ecosystem as a graph and trace any relationship back to the records that support it. Every line on the canvas is an assertion. Select one and you can open the evidence table, then the source record with its exact locator, then go back to the same place in the graph.

> **Demo data.** The entity labels come from the Wayam reference graphic. Every evidence source and record is a synthetic fixture marked `isDemo`, and every reviewer decision is `pending`. Nothing in this dataset counts as verified. The UI says so on every screen.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest: validation, permissions, pagination, traversal, evidence linkage, URL journey, layout + bundling
npm run typecheck
npm run lint
npm run build
```

Built with Next.js 16 (App Router, Turbopack), React 19, TypeScript and React Flow 12. Typography is Geist only: Geist Sans for all text, with hierarchy carried by weight and size, and Geist Mono for IDs and locators. Both are loaded with `next/font`.

## Walkthrough

1. **Overview.** Wayam.ai sits in the middle, with the seven families from the reference graphic arranged around it as colour-coded zones. Each family also has a glyph so colour is never the only cue. How an edge is drawn tells you its evidence state:

   | Look | Glyph | Meaning |
   | --- | --- | --- |
   | Solid | ● | Evidence linked, but not reviewed |
   | Dashed | ○ | No evidence linked, so treat it as unverified |
   | Red dotted | ✕ | Disputed: at least one record contradicts it |
   | Green, thick | ✓ | Verified: reviewed evidence from a non-demo source |

2. **Search** (press `/`) for `Vakyam`. The canvas centres on it and the inspector shows its type, ID, aliases, provenance, evidence summary and links grouped by predicate. Inbound and outbound links are listed separately.
3. In the Links list, click the badge next to **Call Analytics & QA** to open the relationship inspector. It shows the triple, what the claim means, its provenance, and evidence counts by stance.
4. **View evidence** opens a database-style table. It has typed, sortable columns, search, and filters for kind, stance, source and date. It is paginated and has a raw JSON toggle.
5. Click **Fee disclosure skipped**. The record viewer shows the transcript timeline with the cited span highlighted, the extracted content, the source metadata and checksum, the extraction method, the ingestion history, and every graph claim this record bears on. The audio file isn't in storage, so the viewer says so and falls back to the transcript.
6. **Back to graph** returns you to the same selection with the evidence table still open. **Show in graph** jumps to another claim that the record supports.

Other paths to try from the welcome panel:
- *Safety & Surveillance applied in Mining* shows image regions drawn from pixel locators.
- *Arjuna implements 3D / Spatial AI* is a disputed claim.
- `?edge=r-dev-pariksha` is a relationship with no evidence at all.

Double-click a node (or press `+` on a focused node) to load its neighbours. Expanding **Computer Vision** reveals detail-tier capabilities. The **List** view shows the same filtered graph as keyboard-navigable tables. **Schema** shows the classes and predicates.

The **Viewing as** menu switches between demo roles. An *Analyst* can't see restricted records: they're left out of counts and tables, and `/records/rec-call-account` returns *not found*. An *Admin* can see them.

## Reading the graph

The canvas follows *overview first, detail on demand*.

- **Grouped links (default).** At rest, each pair of families is joined by one band instead of every individual line. The band's width grows with its number of links, and its colour blends from one family's hue to the other's. Its badge shows the count plus a small bar of evidence states. Hover a band to see which predicates it holds. Click the number to open it into individual links. Switch to **All links** in the toolbar to draw everything. Relation and evidence filters switch this on automatically, because they are questions about specific links.
- **Selection shows real links.** Clicking an entity (or hovering over it) draws its own links with labels and fades everything else. The traversal trail is drawn with an orange halo.
- **Data-driven layout.** Families are placed on a 3×3 grid around Wayam.ai. An exhaustive search over the possible arrangements picks the one that puts the most heavily linked families next to each other. Inside each zone, members are ordered by where their neighbours are (barycentre ordering), which removes most crossings. Links bend around the centre node instead of running through it, and band badges slide along their curves so they never overlap.
- **Semantic zoom.** Zoomed far out (and on phones), zones collapse into labelled blocks showing their counts. Zoom in to see each entity again.
- **Filters frame the result.** When filters hide entities, the remaining members close up, zones shrink, and the view refits. Zones say "3 of 7". A `+N` badge means N links exist that aren't loaded yet. Click it to load them.
- **Right-click an entity** (or press Shift+F10 / the Menu key on a focused one) to inspect, expand, isolate, view evidence, find a path, copy a link, or hide it from the canvas.
- **Find path** (header, welcome panel, or context menu) answers "how is A connected to B?". It finds the shortest chain of relationships in either direction, loads more of the graph if needed, draws the path on the canvas and puts it in the trail.
- **`?`** opens every shortcut and gesture. First-time visitors get a one-time tip card.
- **Evidence in the inspector.** Selecting an entity or relationship shows its top three evidence records inline, with contradicting records first. Each opens straight into the record viewer.
- **Step through records.** In the record viewer, the arrows (or ← / →, J / K) move through the current evidence table, keeping its filters and sort order. Stepping replaces the history entry, so Back returns to the table.
- **Feedback you can undo.** Actions confirm themselves in a toast: hiding an entity (Undo), loading neighbours (Collapse), finding a path (Clear path), copying a link.
- **Active filter chips** sit on the canvas and List view, so it's always clear why something is missing. Each chip removes its own filter, and "Clear all" removes them all.
- **Recently viewed** entities and relationships appear on the welcome panel. They are stored only in this browser.
- **Collapsible filter panel** on desktop. The collapsed strip shows how many filters are active.
- **Command bar (Ctrl/⌘ + K).** Jump to any entity, or run any action that fits the current state: find a path, export the trail, expand, open evidence, switch views or link mode, clear filters, change theme, copy a link.
- **Export trail.** The Export trail button at the right of the trail bar downloads a Markdown report of the current path. For each hop it gives the claim, its status and provenance, and every evidence record behind it with its exact locator and a link to the record. It also states plainly which hops are unsupported or disputed. Demo data is flagged at the top, and restricted records never appear in an export the viewer couldn't open.
- **Bento modals.** The record viewer is a bento grid: the source preview is the hero tile, with separate tiles for the title and citation, graph claims, source, extraction, history, and other records from the same source. The help dialog and the command bar (a launcher of quick-action tiles when empty) use the same tiles. Every "back" is the same button, with an arrow that nudges on hover. The inspector offers "Back to <previous step>" along the trail.
- **Light and dark themes** use the same neutral palette as the Chronos app: pure greys, near-black surfaces in dark mode, and borders in three strength levels. The theme follows the system until you use the Dark / Light pill in the header. The choice is saved in a cookie, so the server renders the right theme in the first HTML with no flash. "Use the system theme" in the command bar clears it. High-contrast preferences are honoured in both themes.
- **Arrows.** Every link has a fixed-size arrowhead, larger when highlighted. Bands have arrowheads coloured by the family they point into, with an arrow at both ends when some links run the other way.
- **Focus and selection are distinct.** Keyboard focus is always a blue ring with a small gap. Selection is a neutral two-layer ring. Trail entities carry a numbered step (1, 2, 3…) instead of a coloured underline. Trail links get a soft neutral halo and a dash that flows in the claim's direction. Cited regions, spans and rows in the source preview share one highlighter colour.
- **Motion.** On first load the family zones rise in one after another, entities follow, and the bands fade in last. Panels rise, the evidence sheet slides up, the record viewer scales in, and hover cards, menus and chips fade in, all on one easing curve and animating transform and opacity only. Everything stops under reduced-motion settings, including looping animations.
- **Hover.** Every control uses one 180 ms ease-out transition (borders and surfaces step up, and buttons give slightly when pressed). Hovering a link highlights it, both of its ends and its label. Hovering a band highlights the two families it joins and fades the other bands. Header controls are pills, as in Chronos.

These choices follow published guidance on exploring large graphs: progressive disclosure and combos/aggregated links from Cambridge Intelligence, and the expand, dismiss and shortest-path interactions of Neo4j Bloom.

## Icons and brand

- **Wayam AI logo.** The official mark (`public/brand/wayam-mark.svg`) is the header logo and the favicon (`src/app/icon.svg`). A white-glyph version sits inside the Wayam.ai node.
- **Generated icon set.** `docs/icon-prompts.md` has Google Flow prompts for 63 isometric icons: the 9 families, all 49 entities and the 5 evidence-record kinds. It also covers a 3D Wayam logo tile and three hero renders. The prompts use one locked style block, a colour line per family that matches the graph's zones, and a reference-image workflow, modelled on the Arjuna × Tasara icon set.
- **Pipeline.** Export from Flow as `<key>.png` into `icons-raw/`, then run `python scripts/icons_cutout.py`. It removes the white background from the edges inward (white parts of an object survive), trims, centres at 256 × 256 and writes `public/icons/<key>.png`. `--missing` lists what's left. The server lists `public/icons` on each request and each place an icon appears (canvas nodes, family zones, the inspector tile, search, the command bar, evidence cards) falls back from the entity's own icon to its family icon to a glyph. Nothing is requested unless the file exists.

## Architecture

```
src/
  lib/ontology/
    types.ts          domain + API contract types
    seed/             schema (classes, predicates), entities/relationships, demo evidence
    validation.ts     relation direction/type-pair checks, orphan + locator validation
    access.ts         viewer roles and clearance (server-side policy)
    repository.ts     read model: overview, search, bounded BFS neighbours, evidence joins, previews
    ingest.ts         import adapter: document pages, transcripts, SQL rows, image boxes, sensor excursions → EvidenceRecords
    graph-model.ts    client display model: merge/collapse, filters, shortest path, grid layout with
                      slot search + barycentre ordering, link bundling, zone compaction
    url-state.ts      every view ↔ query string
    client.ts         OntologyDataAdapter interface + HTTP implementation
    server.ts         viewer resolution + response helpers (server-only)
  app/api/ontology/…  route handlers (below)
  components/explorer/
    OntologyExplorer  orchestrator: URL state, loading, selection, path
    graph/            React Flow adapter: GraphCanvas (bands, toolbar, legend, semantic zoom),
                      nodes, edges, geometry (routing + label planning), NodeMenu
    controls.tsx      Select (listbox), Switch, Segmented, icons
    Assist.tsx        PathFinder, HelpDialog, FirstRunTip
    NodeInspector, EdgeInspector, EvidenceSheet, RecordViewer, SourcePreview,
    FilterRail, PathTrail, SearchBox, ListView/SchemaView
```

**Why React Flow:** the graph is small at the top level and grows in bounded, paginated steps. React Flow renders DOM nodes, which gives accessible, focusable elements, custom node content (glyphs, counts, hover peeks), a minimap and controls, and floating edges with custom SVG markers. Only `graph/GraphCanvas.tsx` imports it. If the dataset outgrows DOM rendering, a WebGL renderer such as Sigma.js can replace that one component behind the same props.

**Data flow:** the server renders the bounded overview (`overview()`). Everything else loads on demand through `OntologyDataAdapter`. Stale requests are aborted and search is debounced. Fetched domain data (`GraphData`) is kept separate from display state (positions, filters, selection). Node positions are deterministic and never re-laid out while you inspect. Nodes added by an expansion are placed outward from their anchor.

### API

| Route | Purpose |
| --- | --- |
| `GET /api/ontology/overview` | Bounded initial graph, family counts, schema |
| `GET /api/ontology/entities?query=&type=&cursor=&limit=` | Search by label, alias or ID |
| `GET /api/ontology/entities/:id` | Entity detail with inbound/outbound links and evidence counts |
| `GET /api/ontology/entities/:id/neighbors?direction=&relation=&depth=&cursor=&limit=` | BFS limited to depth 3 and 50 results per page, cycle-safe, paginated |
| `GET /api/ontology/relationships/:id` | Triple, meaning, provenance, stance counts, sibling claims |
| `GET /api/ontology/relationships/:id/evidence?stance=&cursor=&limit=` | Evidence for one claim |
| `GET /api/ontology/evidence?entityId=&relationshipId=&kind=&stance=&sourceId=&query=&from=&to=&sort=&cursor=&limit=` | Evidence table |
| `GET /api/ontology/evidence/:id` | Record, source, locator, every claim it bears on |
| `GET /api/ontology/sources/:id/preview` | Sanitised preview, with restricted transcript segments redacted |
| `/records/:id` | Shareable record URL (opens over the graph) |

Missing and forbidden items return the same `404`, so IDs can't be probed. Responses are `private, no-store` and carry an `x-data-classification` header.

### Domain model

- **OntologyType**: a schema class (`Product`, `Industry`, `ClientOrganization`…), kept separate from instances. `Industry` and `ClientOrganization` are different classes, and no client organisations are seeded.
- **Entity**: stable ID, label, aliases, type, properties, lifecycle status, and a `tier` (`overview` or `detail`).
- **RelationType**: machine name, label, inverse label, allowed subject/object classes, direction.
- **Relationship**: an assertion with status (`draft | verified | disputed | deprecated`), validity interval, creator/reviewer and provenance. Several claims about the same pair stay separate and are never merged.
- **EvidenceSource**: the immutable artifact: URI, MIME type, checksum, owner, classification, and whether a file is available.
- **EvidenceRecord**: a cited fragment with a typed locator: `page`, `time`, `bbox`, `row` or `interval`.
- **ClaimEvidence**: links a record to a relationship or entity with a stance (`supports | contradicts | context`), an excerpt, a model confidence and a reviewer decision. Model confidence is shown as an extraction score and is never treated as verification.

**Integrity rule used throughout:** a claim is only *verified* when its status is `verified` **and** at least one supporting link has been accepted by a reviewer **and** comes from a non-demo source. Demo evidence can never meet that bar.

## Replacing demo data with real data

1. Implement the `OntologyRepository` methods against your store. The in-memory indexes correspond to the database indexes you'll need:
   - `entity(id)` lookups
   - adjacency on `(subject_id)` and `(object_id, relation_type_id)`
   - `claim_evidence(target_kind, target_id)` and `(evidence_record_id)`
   - full-text search on `entity(label, aliases)` and `evidence_record(title, content)`

   For PostgreSQL, normalised tables with recursive CTEs capped at depth 3 are enough. A separate graph database only earns its place once you need multi-hop analytics across millions of edges or path queries deeper than about 4 hops at interactive speed.
2. Feed real artifacts through `lib/ontology/ingest.ts`. Keep source IDs and locators, run `validateDataset`, and set `isDemo: false`.
3. Replace `resolveViewer` in `lib/ontology/server.ts` with your session and tenant lookup, and remove `/api/session/role`. Every repository read already goes through `canSee`.
4. Serve file previews from object storage as short-lived signed URLs from `/sources/:id/preview`, after the access check. Never expose raw bucket paths.
5. Set `dataset.isDemo = false`. The header then shows *Live data*.

## Limitations

- The data is an in-memory demo, so curation edits (accepting evidence, changing claim status) and saved views aren't persisted. Shareable URLs cover saved views for now.
- There is no real authentication. The role cookie exists only to exercise the access policy.
- Previews are synthetic. The image is a rendered stand-in and the audio file is deliberately missing so the fallback path shows.
- The reference PNG wasn't in the workspace. The seven families, their labels and hues come from the build prompt's table.
- Tests cover the data layer, layout and bundling, and the URL journey (graph → evidence → record → graph). There are no browser end-to-end tests yet. The flows were checked by hand in Chrome at desktop and phone widths.
- Path finding runs over the loaded graph, extended by one two-hop load around each end. On a large real graph, move it to a server-side bounded search.
