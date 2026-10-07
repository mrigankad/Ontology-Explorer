# Google Flow (Imagen) prompts: isometric icon set for the Wayam Ontology Explorer

The set has 63 icons, one for every key the explorer looks up. These are:

- the 9 ontology families
- all 49 entities (including the detail tier)
- the 5 evidence-record kinds

It also has 3 hero renders and a 3D version of the Wayam AI logo. The workflow follows the Arjuna × Tasara architecture set (`arjuna-tasra-architecture/docs/icon-prompts.md`): one locked style block, one reference image, keys that match filenames. The style moves from a three-quarter view to **true isometric**, and every family has its own colour, so each icon matches its zone on the graph.

Paste the **style block**, then the **colour line** for the icon's family, then one **subject line**. Keep the style block identical across the whole set.

## How to run it in Flow

1. Go to New project, then Image. Set the aspect ratio to **1:1**, generate 4 variants per prompt, and pick the cleanest: whole object in frame, centred, no stray parts, no floor.
2. Generate **`wayameye`** first and approve it. Then attach it to every other prompt as a **reference image** with *"match this style, material, lighting and isometric angle"*. This keeps the whole set consistent.
3. For anything that shows the Wayam logo, also attach **`docs/brand/wayam-logo-reference.png`** and say *"use the attached logo exactly"*.
4. Keep the **pure white background**. Reject any variant with a floor plate, a tinted backdrop or a cast shadow that spreads beyond the object.
5. Download each image as PNG, name it after its **key** (`wayameye.png`, `family-product.png`, …), and put it in `icons-raw/`.
6. Run `python scripts/icons_cutout.py`. It removes the white background (only from the edges inward, so white parts of the object stay), trims and centres each icon at 256 × 256, and writes it to `public/icons/`. Run `python scripts/icons_cutout.py --missing` to see what's left.
7. Reload the explorer. Icons appear wherever their key is used: canvas nodes, family zones, the inspector tile, search results, the command bar and evidence cards. Anything not generated yet keeps its current glyph.

The canvas shows icons at 18 px and the inspector at 32 px. Keep silhouettes **bold and simple**: one clear object, few small parts, no fine text.

## Style block (paste before every subject)

```
Isometric 3D icon, true isometric projection with 30-degree angles and no perspective distortion, a single isolated object, soft clay-like matte plastic with slightly glossy highlights, rounded bevels on every edge, main body in the family colour given below, small accent details in the Wayam orange gradient (#FFA12B at the top fading to #DC440C at the bottom), secondary parts in off-white #F5F5F5 and light grey #D4D4D4, soft diffuse studio light from the top left, gentle ambient occlusion, a small soft contact shadow directly under the object, pure white background, no floor plate, no text, no letters, no numbers, no logos, no people unless described, centred with 14% padding, bold silhouette that still reads at 24 px, clean Blender Cycles product render, no grain, no environment reflections, 1:1.
```

## Colour line (paste after the style block)

Each family uses the same hue as its zone and nodes on the graph.

| Family | Keys | Colour line |
|---|---|---|
| Company | `family-company`, `wayam` | `Main colour: Wayam orange gradient #FFA12B → #DC440C.` |
| Products / Platforms | `family-product` and each product | `Main colour: warm amber orange #D9822B, lighter #F0A95A highlights.` |
| Domains / Capabilities | `family-capability` and each capability | `Main colour: violet #7A4ED9, lighter #A98BEF highlights.` |
| Technologies / Models | `family-technology` and each technology | `Main colour: cobalt blue #2F6FDE, lighter #6E9BEF highlights.` |
| Data / Information | `family-data` and each data type | `Main colour: green #2C9A56, lighter #5FC486 highlights.` |
| Use Cases / Solutions | `family-solution` and each use case | `Main colour: teal #11979A, lighter #4CC5C6 highlights.` |
| Industries | `family-industry` and each industry | `Main colour: coral red #D4443B, lighter #EE7A72 highlights.` |
| Clients | `family-client` | `Main colour: slate #5F6B7E, lighter #8E99AB highlights.` |
| Users / Stakeholders | `family-stakeholder` and each role | `Main colour: lavender #9580D4, lighter #BBAAEB highlights.` |
| Evidence records | `record-*` | `Main colour: graphite #323232 with off-white #F5F5F5 surfaces; one small Wayam-orange accent only.` |

## The Wayam AI logo

| Key | Subject line |
|---|---|
| wayam | Subject: the Wayam AI logo as an isometric 3D app tile. A thick rounded-square slab with soft bevels, its top face filled with the Wayam orange vertical gradient (#FFA12B at the top to #DC440C at the bottom). Embossed on the top face is the logo glyph in glossy white, raised a few millimetres: a stylised letter W whose centre stroke rises into a small human figure with arms lifted, and a round dot for the head floating above it. Use the attached logo reference exactly; do not redraw or restyle the glyph. |

The flat logo stays as it is in the UI (header mark and favicon, from `public/brand/`). This 3D tile is for the Wayam.ai node, decks and hero images.

## Families (9)

| Key | Subject line |
|---|---|
| family-company | Subject: a small isometric headquarters building, three stacked rounded floors with a flat roof, one orange accent stripe around the top floor |
| family-product | Subject: a stack of three rounded app tiles, slightly offset like cards, the top tile showing a simple raised square window |
| family-capability | Subject: a rounded gear interlocking with a smaller gear, a soft glowing core in the centre of the large gear |
| family-technology | Subject: a rounded server block with two drive slots on the front and a small glowing chip on top |
| family-data | Subject: a database cylinder made of three stacked rounded discs, a thin glowing band between each disc |
| family-solution | Subject: a rounded puzzle piece fitting into a slot on a small base, the fitted edge glowing softly |
| family-industry | Subject: a small factory with a sawtooth roof and one short chimney, rounded and toy-like |
| family-client | Subject: a small office building with a flag on a short pole, rounded corners |
| family-stakeholder | Subject: three rounded figure busts side by side, the middle one slightly taller and in front |

## Products / Platforms (5)

These names come from the reference graphic. Each subject shows what the name suggests without claiming product features.

| Key | Subject line |
|---|---|
| wayameye | Subject: a rounded eye-shaped camera module, a large glossy lens as the iris, mounted on a short stubby pole |
| vakyam | Subject: a rounded speech bubble with three short raised sound-wave bars inside it |
| pariksha | Subject: a clipboard with a raised check mark and two short lines, a small magnifying glass leaning on it |
| sutradhar | Subject: three rounded nodes joined by a single glowing thread, like beads being guided along a string |
| arjuna | Subject: a stylised bow with an arrow nocked and pointing at a small round target, sleek and rounded |

## Domains / Capabilities (12)

| Key | Subject line |
|---|---|
| computer-vision | Subject: a large rounded camera lens with a square focus bracket floating in front of it |
| nlp | Subject: two overlapping speech bubbles, the front one with three raised text lines |
| agentic-ai | Subject: a small rounded robot head with a glowing visor, one antenna, and a tiny gear floating beside it |
| data-analytics | Subject: a rounded bar chart of three rising bars with a small trend line arcing over them |
| automation | Subject: a rounded conveyor loop carrying two small cubes, with a circular arrow above it |
| security-compliance | Subject: a rounded shield with a raised check mark on its face |
| spatial-ai | Subject: a wireframe cube with glowing corner points, a small solid cube inside it |
| object-detection | Subject: a small rounded parcel inside a square bounding-box frame with thick corner brackets |
| ppe-detection | Subject: a rounded safety hard hat with a small square bounding-box frame around it |
| ocr | Subject: a page with raised text lines and a scanning bar crossing it horizontally |
| speech-to-text | Subject: a rounded microphone with a short line of raised text blocks coming out of its side |
| summarization | Subject: three stacked pages funnelling down into one short card |

## Technologies / Models (5)

| Key | Subject line |
|---|---|
| llms | Subject: a rounded cube made of a grid of small glowing tiles, like a neural block |
| cv-models | Subject: a stack of three translucent rounded layers, the top layer showing a simple lens icon |
| vector-db | Subject: a database cylinder with small glowing points arranged in a constellation on its top face |
| cloud-platforms | Subject: a soft rounded cloud sitting on top of a small server block |
| data-apis | Subject: a rounded plug connector with two prongs, a short cable curling behind it |

## Data / Information (5)

These are categories of data, not files.

| Key | Subject line |
|---|---|
| images | Subject: a rounded photo frame showing a simple mountain and sun, standing upright |
| audio | Subject: a rounded waveform made of seven raised bars of varying height on a small base |
| documents | Subject: two stacked pages with a folded corner and raised text lines |
| structured-data | Subject: a rounded table grid of three by three cells, one header row raised higher |
| sensor-iot | Subject: a small rounded sensor puck with a short antenna and three signal arcs above it |

## Use Cases / Solutions (7)

| Key | Subject line |
|---|---|
| safety-surveillance | Subject: a hard hat and a small wall-mounted camera side by side on a tiny base |
| quality-inspection | Subject: a small gear under a magnifying glass, a check mark floating beside it |
| itsm | Subject: a rounded service ticket with a raised check mark, a small wrench leaning on it |
| regulatory-compliance | Subject: a rolled scroll with a round wax seal on its ribbon |
| call-analytics | Subject: a rounded telephone handset with a small bar chart rising beside it |
| document-intelligence | Subject: a page with raised lines and a small sparkle star on its corner |
| process-automation | Subject: three rounded boxes joined left to right by short arrows, the last one glowing |

## Industries (7)

Industries are sectors, not clients. Keep them generic, with no company marks.

| Key | Subject line |
|---|---|
| mining | Subject: a small mining dump truck with large rounded tyres, carrying a few rock chunks |
| manufacturing | Subject: a small robotic arm on a round base, gripper holding a cube |
| healthcare | Subject: a rounded medical cross on a small heart-shaped base |
| it-enterprise | Subject: a small office tower with a rounded laptop leaning against its base |
| bfsi | Subject: a small bank building with three columns and a triangular roof, one coin in front |
| retail | Subject: a small shopping bag with rounded handles and a price tag hanging from it |
| government | Subject: a small civic building with a dome and four columns |

## Users / Stakeholders (7)

These are generic roles. Use simple rounded figure busts with no faces, like Arjuna's `users` icon.

| Key | Subject line |
|---|---|
| business-user | Subject: a rounded figure bust with a small briefcase beside it |
| operations-team | Subject: a rounded figure bust wearing a hard hat, a small clipboard beside it |
| it-team | Subject: a rounded figure bust with a headset, a small laptop beside it |
| compliance-team | Subject: a rounded figure bust with a small shield beside it |
| data-scientist | Subject: a rounded figure bust with a small bar chart beside it |
| developer | Subject: a rounded figure bust with a raised code-bracket symbol beside it |
| end-customer | Subject: a rounded figure bust holding a small shopping bag |

## Evidence records (5)

These show on evidence cards. Use the graphite colour line.

| Key | Subject line |
|---|---|
| record-document-passage | Subject: a page with a folded corner and one highlighted text line in Wayam orange |
| record-transcript-segment | Subject: a short waveform above two raised text lines, one segment highlighted in Wayam orange |
| record-image-region | Subject: a photo frame with a square bounding box in Wayam orange drawn over part of it |
| record-table-row | Subject: a small table grid with one row raised and highlighted in Wayam orange |
| record-sensor-interval | Subject: a line chart on a small panel with one span shaded in Wayam orange |

## Hero renders (16:9: decks, the docs, the welcome panel)

Use the same style block, change the aspect ratio to **16:9**, and allow a subtle white studio floor.

- **Ontology overview.** *An isometric archipelago of seven small rounded islands, each in one family colour and holding a few miniature objects from that family (app tiles, gears, servers, database cylinders, puzzle pieces, a factory, figure busts). In the centre is a raised plinth with the Wayam AI 3D logo tile (use the attached logo exactly). Thin glowing bridges in soft gradient colours connect the islands, with small arrowheads showing direction.*
- **Evidence trail.** *An isometric path of four rounded stepping stones numbered by position with small raised dots, not digits. It leads from the Wayam AI logo tile to a mining truck. Each stone has a small document or waveform card beside it, and one card is highlighted in Wayam orange.*
- **No evidence yet.** *A single rounded stepping stone with a dashed outline and a small empty document card beside it, soft and calm, lots of white space.*

## What stays as line icons

Small interface controls stay as the existing SVG line icons in `src/components/explorer/controls.tsx`, because rendered icons turn to mush at 14–16 px. These are:

- zoom and fit
- back and close
- sort arrows
- search and export
- theme, keyboard and the minimap toggle

Generate rendered versions only for places where an icon is 28 px or larger, such as the command-bar launcher tiles. If you do, use the graphite colour line and name them `ui-<name>.png`.
