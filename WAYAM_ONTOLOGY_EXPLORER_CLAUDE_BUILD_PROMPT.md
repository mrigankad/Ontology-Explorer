# Claude build prompt: Wayam ontology explorer and evidence viewer

Attach **Wayam AI ontology Graph Reference.png** along with this prompt. If you are working inside a repository, inspect its code and design system before implementing anything.

---

You are the lead product designer, frontend engineer, and data architect for Wayam AI. Build a working **ontology exploration engine** as a reusable UI component and, if this repository contains an application, integrate it into an appropriate page. The attached image is a **taxonomy and visual reference**, not a specification to reproduce as a static infographic.

## What the product must do

Let someone start at a high-level graph of Wayam's ecosystem, follow a product/capability/solution/industry relationship, inspect any node or edge, and reach the **actual records that support the claim**. The final destination is an evidence/database viewer with searchable records, source previews, provenance, and a way back to the graph. A relationship without supporting records must say **unverified** or **no evidence linked**; never fabricate evidence.

Examples of the desired journey:

1. `Wayam.ai → develops → WayamEye → solves → Safety & Surveillance → applied in → Mining → evidence records`.
2. `Wayam.ai → develops → Vakyam → supports → Call Analytics & QA → processes → Audio → call, transcript, timestamps, QA findings, and source audio`.
3. Search `Computer Vision`, open the capability, filter for related products, click an edge, inspect the sources supporting that specific relationship, and open one source in a full viewer.

These are illustrative navigation paths, **not assertions that every link has verified evidence**. If the repository's real data disagrees, display the real data and flag missing links for curation.

## First inspect the repository

- Determine the app framework, routing, styling conventions, component library, state management, backend, database, auth, tests, and existing graph/data viewers. Follow the project's conventions. If it is the Wayam React/Vite application, use its current architecture rather than adding a second framework.
- Find real entity, product, asset, client, document, media, and evidence data. Identify what is already available and what requires an adapter, migration, or explicit demo fixture.
- Give a short implementation plan and a data inventory, then **implement the feature**. Do not stop after planning or deliver only mockups. Ask a question only if an essential credential or irreversible decision blocks work; proceed with a reasonable documented assumption otherwise.
- Reuse existing icons, typography, colors, accessibility patterns, API clients, and permissions. If those are absent, build a small coherent set of design tokens based on the attached image, without hardcoding presentation values throughout the components.

## Interpret the reference image faithfully

The reference has a central orange `Wayam.ai` company node. Around it are seven color-coded families:

| Family | Example labels in the image | Visual cue |
| --- | --- | --- |
| Products / Platforms | WayamEye, Vakyam, Pariksha, Sutradhar, Arjuna | Pale orange |
| Domains / Capabilities | Computer Vision, Natural Language Processing, Agentic AI, Data Analytics, Automation, Security & Compliance, 3D / Spatial AI | Purple |
| Technologies / Models | LLMs, Computer Vision Models, Vector Database, Cloud Platforms, Data Sources / APIs | Blue |
| Data / Information | Images, Audio, Documents, Structured Data, Sensor / IoT Data | Green |
| Use Cases / Solutions | Safety & Surveillance, Quality Inspection, IT Service Management, Regulatory Compliance, Call Analytics & QA, Document Intelligence, Process Automation | Teal |
| Industries / Clients | Mining, Manufacturing, Healthcare, IT / Enterprise, BFSI, Retail, Government / Public Sector | Red |
| Users / Stakeholders | Business User, Operations Team, IT Team, Compliance Team, Data Scientist, Developer, End Customer | Lavender |

The image also shows typed links such as `develops / owns`, `enables`, `uses`, `processes`, `solves`, `serves`, and `used by`, plus example subject–predicate–object triples. Use this vocabulary as a starting seed. Treat **Industry** and **Client Organization** as different entity types: `Mining` is an industry; it is not itself a client. Treat `Images` as a data category, not as an actual image file. Distinguish a **schema/type** (`Product`, `Capability`, `EvidenceRecord`) from an **entity instance** (`WayamEye`, `Computer Vision`, a specific call recording). Normalize ambiguous edge direction and labels in the data model rather than assuming the arrows in the graphic establish verified facts.

Create useful cross-links between families so the user can explore beyond a star centered on Wayam.ai. Do not assign an individual product to a model, customer, or solution without a real source or a clearly labeled demo fixture. Allow multiple products to share capabilities, models, and source types.

## Experience and interaction design

Build a responsive workspace with these coordinated regions:

1. **Explorer header:** title, breadcrumb/path, ontology-versus-instance mode if both exist, global search, dataset selector if applicable, saved/shareable view URL, and clear demo/live-data indicator.
2. **Graph canvas:** pan/zoom/fit, stable positions, directional and labeled edges, zoom-aware labels, hover previews, click selection, keyboard navigation, minimap or overview for large graphs, and a legend/filter menu. Use family colors from the reference, but never rely on color alone. Prefer a curated overview layout for the small top-level graph and a scalable graph layout for expanded neighborhoods.
3. **Context controls:** search by label and identifier; filter by type, relation, product, industry, verification state, source, and date; expand neighbors by direction, relation type, and depth; collapse branches; isolate selection; show/hide evidence nodes; reset. Display counts after filters and indicate that hidden nodes exist.
4. **Node inspector:** clicking a node opens a side panel with title, class, description, ID, aliases, status, last updated, properties, linked entities grouped by predicate, inbound/outbound distinctions, and evidence count. Clicking a related item focuses it in the graph without losing the navigation path. Show loading, missing, and error states.
5. **Relationship inspector:** clicking an edge shows an explicit triple (`subject → predicate → object`), human-readable meaning, provenance, confidence/review state if present, supporting and contradicting evidence counts, effective dates, and a `View evidence` action. If an edge has no evidence, say so. Multiple relationship instances between the same pair must remain distinguishable.
6. **Evidence table and record viewer:** clicking `View evidence` opens a database-style results panel or route. Include sortable, paginated rows, typed column headers, search, filters, record count, and a raw/details toggle. A row opens a record page or drawer with metadata, original source, extracted content, citations or page/time/region anchors, annotations, ingestion history, reviewer decisions, and links back to every graph claim it supports. Allow drilling into an image region, document page, audio timestamp, transcript segment, structured row, or sensor interval **when such source data exists**. Make source preview fall back gracefully when a file is unavailable. Provide direct URLs for records and graph selections.
7. **Path and trace view:** show the exact hops traversed from the root to the current entity/evidence, each hop clickable. Permit navigating backward without discarding current filters. Offer a textual list/table alternative to the canvas for accessibility and dense datasets.

Keep the graph readable: a node selection highlights its immediate neighborhood and fades unrelated elements; hover is transient; click is persistent; double-click or an explicit control expands a neighborhood. Avoid uncontrolled auto-layout shifts while inspecting a node. The evidence table is the endpoint of the workflow, not an afterthought under a decorative diagram.

## Domain model and persistence

Implement or adapt these concepts. Fit the existing database first; if the app uses PostgreSQL, a normalized relational schema with indexed adjacency/traversal queries is acceptable. Do **not** introduce a separate graph database merely because the UI is a graph. Document when a graph store would become justified.

- `OntologyType`: ID, label, description, parent/type hierarchy, color/icon metadata. Distinguish schema types from instances.
- `Entity`: stable ID, canonical label, aliases, type ID, description, properties JSON with a defined validation schema, lifecycle status, created/updated timestamps.
- `RelationType`: stable machine name, display label, inverse label if valid, allowed subject/object types, direction, description.
- `Relationship`: stable ID, source entity, relation type, target entity, assertion status (`draft`, `verified`, `disputed`, `deprecated`), optional validity interval, creator/reviewer, timestamps. Allow multiple claims about a pair and do not silently merge them.
- `EvidenceSource`: immutable source identifier, kind, title, URI/storage pointer, MIME type, checksum, acquisition/ingestion date, access classification, owner, and source metadata. Keep blobs in appropriate object storage; store pointers and metadata in the DB.
- `EvidenceRecord`: extracted or curated unit tied to its source; kind, content/structured payload, citation locator (page, line, bounding box, timestamp interval, row key, or other appropriate locator), extraction method/version, ingest status, timestamps, and preview pointer.
- `ClaimEvidence`: join between a relationship or entity-property assertion and an evidence record, with stance (`supports`, `contradicts`, `context`), excerpt, annotation, confidence if derived, reviewer decision, and timestamps. Do not equate model confidence with factual verification.
- Optional `EntityEvidence` for standalone node documentation, `SavedView` for shareable graph state, and audit records for curation changes.

Provide a lightweight ingestion interface that can map existing documents, files, SQL rows, transcripts, and image annotations into evidence records. For a first implementation, an import adapter and a transparent seed fixture are enough; avoid building an entire ETL platform. Preserve source IDs and locators so users can reproduce a claim. Validate relation direction and allowed type pairs, reject orphan references, and define indexes for node lookups, neighbors, relation filters, evidence joins, and full-text search appropriate to the existing stack.

**Data integrity rule:** a graph claim is an assertion; the source is an artifact; the evidence record is a cited fragment or row; the join explains how that fragment supports or contradicts the assertion. Never label a generated description, screenshot text, or synthetic fixture as independently verified evidence.

## API and state contract

Design typed contracts consistent with this repository. At minimum support:

- `GET /ontology/overview` for the bounded initial graph and family counts.
- `GET /ontology/entities?query=&type=&cursor=` and `GET /ontology/entities/:id`.
- `GET /ontology/entities/:id/neighbors?direction=&relation=&depth=&cursor=&limit=` with bounded depth and pagination.
- `GET /ontology/relationships/:id` and `GET /ontology/relationships/:id/evidence?cursor=&limit=&stance=`.
- `GET /ontology/evidence?entityId=&relationshipId=&kind=&status=&query=&cursor=&limit=&sort=` and `GET /ontology/evidence/:id`.
- A secure source preview/stream endpoint or time-limited URL, when storage exists.

These are conceptual endpoint names: adapt to existing routes and conventions. Responses must carry stable IDs, pagination cursors/counts where feasible, loading/error states, evidence totals, data classification, and enough provenance for the UI. URL state should preserve selected node/edge, filters, zoom or focus, and open evidence record where reasonable. Fetch neighbors on demand; do not ship the entire graph to the browser. Debounce search, cancel stale requests, cap traversal, and handle cycles. Keep graph display state separate from fetched domain data.

## Visual and technical quality

- Make the overview feel like the supplied reference: clear central Wayam entity; soft color-coded category groupings; labeled connectors; clean light canvas; readable headings and spacing. Adapt its exact layout to the available viewport and graph density. Do not use the reference image as a flat background.
- If the repository has Wayam brand tokens, use those. Otherwise define a small token map for category hues, text, borders, surfaces, focus, and high-contrast states.
- Use a graph rendering solution that fits the repository and expected dataset; briefly justify the choice after reviewing its current official documentation. Keep rendering components swappable behind an adapter. For accessibility, provide a fully functional structured list/table path through the same data.
- Support keyboard focus, visible focus rings, accessible labels for icon buttons and graph items, screen-reader summaries of selection, reduced-motion preference, adequate contrast, and responsive panel behavior on narrower screens.
- Enforce existing authentication, tenant isolation, record-level access, and redaction **on the server**. Unauthorized graph nodes and evidence must not leak through counts, previews, exports, or direct URLs. Sanitize previews and avoid exposing raw storage credentials. If the repository lacks auth, structure the adapter for later policy enforcement and make demo mode explicit.
- Give useful empty, loading, error, partial-data, and offline/retry states. Prioritize actual graph exploration and evidence tracing over optional animations.

## Deliverables and implementation order

1. Summarize current repository architecture and data sources, identify the integration point, and state which referenced labels are confirmed data versus illustrative seed entries.
2. Define shared types, schema/migrations if needed, relation validation, seed/import logic, and read APIs.
3. Implement the reusable `OntologyExplorer` with typed props/data adapter, graph interactions, inspectors, filters, breadcrumb/path, and URL state.
4. Implement `EvidenceTable` and `EvidenceRecordViewer` with real source links/previews where available. Wire every relevant relationship and node to the correct evidence query.
5. Integrate into the existing app and visual system. Provide a small **clearly marked synthetic demo dataset** only when real source data is unavailable; include evidence fixtures with believable locators but label them `DEMO / NOT VERIFIED` prominently. Do not invent client names, deployment claims, or confidential recordings.
6. Add focused tests for relation validation, permission filtering, pagination, node/edge selection, traversal, evidence linkage, and the graph→record→graph journey. Run the project's type checks, build, and relevant tests; fix failures.
7. Deliver a short README with architecture, schema, ingestion mapping, routes, how to run, how to replace demo data with real data, limitations, and screenshots or a concise UI walkthrough. List changed files and commands/results.

## Acceptance criteria: demonstrate these flows

- The opening view shows Wayam and the seven category families from the reference, with zoomable, labeled, selectable relationships.
- A user can search `Vakyam`, focus it, inspect its properties, traverse to `Call Analytics & QA`, click a relationship, and open a filtered evidence table. If demo data is used, every screen clearly identifies it as demo.
- A user can click an evidence row, see its source, exact locator, extraction/annotation metadata, and the graph claim it supports, then return to the same graph selection.
- A node and a relationship with zero verified evidence each show an honest missing-evidence state and cannot be mistaken for a proven fact.
- Filtering a dense graph remains usable; neighbor expansion is bounded and paginated, and revisiting a view preserves the selection.
- Different evidence modalities render appropriately or show a useful metadata fallback. Restricted evidence remains inaccessible via direct record URL/API.
- The feature compiles, is navigable by keyboard through its list/table alternative, and has no critical console/runtime errors in the demonstrated flows.

Start with repository inspection and a concise plan. Then write the code, run checks, and report exactly what works, what uses demo data, and what still needs a real source or permission mapping. Do not present a static image or disconnected mockup as a completed ontology exploration engine.
