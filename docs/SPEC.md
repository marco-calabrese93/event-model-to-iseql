# SPEC — MVP vs Nice-to-have (ISEQL Event Modeler)

**Assignment (constraint):** a desktop system with a GUI to define event models in ISEQL and generate an ISEQL query
(a pattern / “regex-like”), automatically understanding which ISEQL operator to call, and with which parameters if necessary.
No DB connectivity is required (output only).

---

## 1) MVP — In scope (supported)

### 1.1 GUI & flow (MVP)

- Desktop app (Tauri) with a GUI for event model authoring.
- 3-panel layout:
  - Builder (authoring)
  - Preview (visualization; in MVP can coincide with Builder timeline)
  - Output (ISEQL string + actions)
- Two modes:
  - Expert mode (direct operator/relationship editing)
  - Wizard mode (guided; can be limited but must exist as a mode switch)
- Output panel actions:
  - Copy to clipboard
  - Export `.iseql` (save dialog)
  - Validate (syntactic/semantic per core validator)
  - Reset

### 1.2 Interval drawing (MUST HAVE input in MVP)

- Timeline editor is the primary authoring input:
  - Create intervals by drawing (drag)
  - Move intervals (drag)
  - Resize intervals (handles)
- Timeline units are abstract ticks (not real timestamps).
- The timeline is used to:
  - Define/adjust relationships and constraints
  - Optionally derive operator parameters (if enabled)

### 1.3 Data model (core)

- The internal model is ISEQL-native (not Allen-native).
- Allen relations can appear as UI aliases and must normalize to ISEQL operators during compilation.
- The model must be serializable to:
  - ISEQL output string (primary)
  - JSON (AST export; optional output but used for save/load)

### 1.4 Temporal operators — COMPLETE catalog (ISEQL)

#### A) Allen 13 (complete set, always available)

- The UI must support the complete Allen 13 relations as aliases (at least in Expert mode):
  - Before / After
  - Meets / Met-by
  - Overlaps / Overlapped-by
  - Starts / Started-by
  - During / Contains
  - Finishes / Finished-by
  - Equals

#### B) “Named / acronym” ISEQL operators (dedicated catalog entries)

- The system must support the full catalog of ISEQL temporal operators (ISEQL superset of Allen).
- Operators must be configurable via a catalog (e.g., `operators.json`) and exposed in Expert mode.
- Each operator can have parameters and defaults (see below).

#### Parameters and defaults (MVP)

- Parameters:
  - `ζ` (zeta): comparator (default `≤`)
  - `η` (eta): comparator (default `≤`)
  - `δ` (delta): threshold (default `∞`)
  - `ε` (epsilon): threshold (default `∞`)
  - `ρ` (rho): slack/offset (default `0`)
- Defaults:
  - `ζ=≤, η=≤, δ=∞, ε=∞, ρ=0`
- Serialization:
  - The serializer may omit default parameters where allowed.
  - Parameter presence rules must be deterministic.

### 1.5 Relationship constraints

- Users can define constraints between intervals:
  - Explicit relationships (Allen alias or direct ISEQL operator)
  - Optional numeric/comparator constraints (where supported)
- Constraints must be validated:
  - Basic consistency checks (e.g., incompatible constraints)
  - Parameter domain checks

### 1.6 Composition operators (relational algebra) to build models

- The model supports building event patterns using relational algebra-like composition:
  - Selection/projection/joins as needed for composing reusable blocks
- MVP focus:
  - Enough structure to compose blocks deterministically
  - No optimization required

### 1.7 Resolver (automatic operator + parameter selection) — MVP

- The system includes a rule-based Resolver that:
  - Chooses the appropriate ISEQL operator based on user intent (relationships) and/or interval geometry
  - Fills missing parameters with defaults
  - Optionally derives numeric thresholds from timeline ticks (if the user opts in)
- Deterministic behavior:
  - Same inputs → identical output ISEQL string (byte-for-byte)
- Explainability:
  - For each decision, expose:
    - `ruleId`
    - human-readable explanation text

### 1.8 Reusable building blocks (MUST HAVE) — Save/Load/Compose models

- Users can:
  - Save the current model (or a subgraph) as a reusable block (JSON/AST)
  - Load/insert a block into another model
- Collision handling must be deterministic (auto rename / namespace prefix).
- Minimal binding/mapping UI for required arguments/variables at insert time.

### 1.9 Baseline templates (must work in MVP)

- Provide baseline templates for:
  - BDPE
  - DPE
  - IPE
  - UP
- In MVP, templates can be shipped as static JSON fixtures and loaded via the UI.

### 1.10 Output (MVP contract)

- Primary output:
  - An ISEQL query string (pattern / “regex-like”)
- No DB connectivity (no runtime execution).
- Export `.iseql` saves exactly the output string shown.

---

## 2) Nice-to-have (post-MVP)

- Advanced template editing and authoring tools (template builder)
- Advanced rule authoring UI for Resolver rules
- Autosave in localStorage or disk with versioning/history
- Visual explanations (graph-based) beyond ruleId + text
- Advanced composition/chaining UI for complex patterns

---

## 3) OUT OF SCOPE (explicit)

- Database connectivity or query execution against a DBMS
- Image/video processing or surveillance analytics
- Performance optimization / indexing / query acceleration
- ML-based operator selection (Resolver remains rule-based in MVP)

---

## 4) Minimal assumptions (MVP)

- ISEQL operator catalog is well-defined and can be represented as structured metadata.
- Predicate and operator catalogs are configurable (file/static). In MVP a full UI to author new predicates from scratch is not required.
- Timeline is an abstract authoring aid (ticks), not a real-time clock; serialization follows the serializer’s convention (core tasks later).

---

## 5) User stories & Acceptance (M2.2)

This section defines **3 minimal MVP user stories** with **testable Given/When/Then acceptance criteria**.
No DB connectivity is required; the primary output is a deterministic **ISEQL pattern string** generated from the internal AST via the Resolver.

### US1 — Author an event model by drawing intervals on a timeline

**As a** user  
**I want** to create and edit event instances by drawing intervals on a timeline and labeling them with predicates/arguments  
**So that** I can define the “shape” of an event model visually as the main authoring input.

#### Acceptance (Given/When/Then)

1. **Create interval**
   - **Given** the Builder panel is open and a predicate catalog entry exists (e.g., `hasPkg(personId, pkgId)`)
   - **When** I drag on the timeline to create a new interval
   - **Then** a new interval instance appears with editable start/end (ticks) and a selectable predicate label.

2. **Move interval**
   - **Given** an interval exists on the timeline
   - **When** I drag the interval horizontally
   - **Then** its start/end ticks update consistently, preserving duration.

3. **Resize interval**
   - **Given** an interval exists on the timeline
   - **When** I drag its left or right handle
   - **Then** the corresponding endpoint updates and the UI prevents inverted intervals (start must remain ≤ end).

4. **Label interval**
   - **Given** an interval exists
   - **When** I select a predicate name from the catalog and fill optional arguments (if defined by that predicate schema)
   - **Then** the interval displays the predicate label and the internal model stores the predicate + argument bindings.

5. **Abstract time**
   - **Given** intervals exist with tick-based endpoints
   - **When** I inspect the model/output
   - **Then** the system treats ticks as **abstract** authoring units (no requirement for real timestamps).

#### Gate (per-story)

- It is possible to create/move/resize at least one interval and assign a predicate label + args without runtime errors.
- A deterministic internal representation exists for the interval endpoints (ticks) and labels (predicate/args).

---

### US2 — Generate ISEQL output via Resolver with explainability

**As a** user  
**I want** the system to automatically choose the appropriate ISEQL operator(s) and parameters from what I drew/selected  
**So that** I get a correct ISEQL query without manually managing every operator detail, and I understand why choices were made.

#### Acceptance (Given/When/Then)

1. **Live output**
   - **Given** I have at least two labeled intervals in the Builder
   - **When** I add or edit a relationship (Allen alias or direct ISEQL operator) between them
   - **Then** the Output panel updates the **ISEQL pattern string** in real time (or on an explicit “Generate/Validate” action if live is deferred).

2. **Allen alias normalization**
   - **Given** I select an Allen relation (e.g., _Before_)
   - **When** the Resolver compiles the model
   - **Then** it normalizes the relationship into the corresponding ISEQL operator (e.g., `Bef`/`Aft` where applicable) preserving semantics.

3. **Parameter defaults**
   - **Given** a relationship/operator supports parameters (`ζ/η/δ/ε/ρ`)
   - **When** I do not provide explicit values
   - **Then** the Resolver applies defaults (`ζ=≤, η=≤, δ=∞, ε=∞, ρ=0`) and serialization may omit defaults where allowed.

4. **Derived suggestions (optional)**
   - **Given** I drew intervals such that a threshold can be inferred from geometry (e.g., distance between endpoints)
   - **When** I opt in to “derive thresholds from timeline”
   - **Then** the Resolver proposes/sets concrete parameter values consistent with the drawn ticks.

5. **Explainability**
   - **Given** the Resolver chose an operator and/or parameters
   - **When** I view “Explainability”
   - **Then** the UI shows `ruleId + human-readable description` for each decision (operator choice and parameter compilation).

6. **Determinism**
   - **Given** the same GUI inputs (intervals + relationships + constraints)
   - **When** I regenerate output multiple times
   - **Then** the resulting ISEQL string is identical (byte-for-byte).

#### Gate (per-story)

- A compiled ISEQL string is produced with no DB calls.
- At least one resolver decision exposes a `ruleId` + description.
- Re-running compile with identical inputs yields identical output.

---

### US3 — Save/Load reusable blocks (AST JSON) and export ISEQL

**As a** user  
**I want** to save my current model (or a subgraph) as a reusable block and load it into other models, and export the final ISEQL  
**So that** I can build complex models incrementally and share/port them.

#### Acceptance (Given/When/Then)

1. **Save model/block**
   - **Given** I have a non-empty model
   - **When** I click “Save Model” (or “Save Block”)
   - **Then** the system writes a JSON file (e.g., `.iseqlm.json`) containing at minimum:
     - `schemaVersion`
     - nodes/edges (predicates, operators/relationships, constraints, aliases)
     - metadata (name/description optional)

2. **Load/Insert block**
   - **Given** I have an existing saved block file
   - **When** I choose “Load/Insert Block” and select that file
   - **Then** the block is inserted as a **copy** into the current model graph.

3. **Collision handling**
   - **Given** the inserted block contains identifiers that collide with existing names
   - **When** the insertion happens
   - **Then** the system auto-renames/namespace-prefixes deterministically to avoid collisions.

4. **Parameter binding (minimal)**
   - **Given** the inserted block requires bindings for arguments/variables
   - **When** I insert the block
   - **Then** a minimal mapping UI allows binding required arguments to existing variables/values in the target model.

5. **Export ISEQL**
   - **Given** the model is compilable
   - **When** I click “Export .iseql” (save dialog)
   - **Then** the exported file contains the exact same ISEQL string shown in Output.

#### Gate (per-story)

- Saving produces a JSON file with `schemaVersion` and a deterministic structure.
- Loading/inserting does not overwrite existing identifiers; collisions are resolved deterministically.
- Export writes `.iseql` containing exactly the current Output string.
