# Implementation handoff log

## 2026-10-16 — Started
- Request: implement `/home/yosuke/Downloads/ts/causal_investigation_poc_requirements.md`; maintain progress for another AI.
- Repository initially empty. No AGENTS.md found.
- Scope: local-only React + TypeScript + Vite SPA, pure deterministic simulation, tutorial + two investigations, tests and documentation.
- Decisions: declarative expression AST; synchronous previous-tick updates; SVG graph/chart to avoid extra graph dependencies. No cloud services.
- Current: implementing core and scenarios, then UI, validation, documentation.
- Verification: not yet run.

## Core / scenario implementation
- Added typed expression primitives, synchronous ticks, cyclic graph support, node/edge faults, interventions, deterministic observation transforms and validation.
- Added tutorial, periodic shared-resource overload and delayed accumulation scenarios. Hidden connection is withheld from graph, but actively measurable.
- Scenario 2 choice: attenuated edge delays an accumulation-triggered feedback response; decoy instrument has +18 offset.
- Next: interaction UI and tests. npm installation running.

## UI implementation
- Added responsive graph inspector, explicit instrument activation, overlaid timeline, simulation controls and intervention sliders.
- Added experiment snapshots/comparison, notebook + prediction, localStorage session save/load, opt-in hints and confirmed solution reveal.
- Answer form only appears on request; incorrect answers preserve hidden evidence. Prediction text is self-evaluated.
- Next: dependency installation result, compile/test, browser verification and documentation.

## First verification
- `npm install` initially failed with sandbox DNS EAI_AGAIN; rerun with approved network permissions succeeded.
- `npm run build`: PASS. `npm test`: PASS, 13 tests (engine + scenarios).
- `npm audit` identified vulnerabilities in Vitest 3 transitive dependencies. Updating to patched Vitest before final checks.
- Next: browser QA and stronger schema/primitive coverage; write README and playability evaluation.

## Browser verification and documentation
- Browser verified: instrument activation, slider intervention (keyboard End), stepping, experiment record, reset, save/load, prediction submission and successful explanation.
- Scenario 1: activated N01/N04/N08 together and inspected rendered graph/time-series. Console error log empty.
- Responsive 390px viewport: document clientWidth == scrollWidth (375), no horizontal overflow. Returned viewport to normal.
- Improved SVG accessibility from image to group so nodes/edges are exposed as keyboard buttons.
- Removed external Google Fonts dependency; app runtime is fully local.
- Vitest updated to 5.0.5: install audit reports 0 vulnerabilities. Added primitive/invalid-schema coverage: 15 tests pass.
- Scenario 2 feedback now affects N05 rate, making the displayed loop an actual dynamic dependency.
- Added README (startup, UI, architecture, DSL, scenario authoring, limits) and POC_EVALUATION (author assessment, no claim of blind user testing).
- Remaining: final build/test and final handoff. No cloud deployment requested or performed.

## Completed / handoff
- Final `npm run build`: PASS (TypeScript + Vite 7.3.7 production bundle).
- Final `npm test`: PASS, 15 tests on Vitest 5.0.5.
- `npm install`: PASS with approved network access; patched dependency install reported 0 vulnerabilities.
- Final screenshot saved and visually reviewed: `docs/gameplay.jpg`; README embeds it.
- Deliverables: local playable SPA, tutorial + 2 scenarios, engine/scenario separation, tests, README, evaluation, this log.
- Remaining optional work: graphical causal-map editor and automated browser E2E suite. Existing manual browser verification is documented above.
- Known limitations: README / POC_EVALUATION contain details; no independent blind playtest conducted. Free-text predictions are intentionally self-evaluated. Dynamic histories should be bounded for long-term use.
- Resume: read this file and README, run `npm install` if needed, `npm test`, then `npm run dev`. Add scenarios as data in src/scenarios.ts; do not hardcode scenario branches in engine.ts.

## 2026-10-16 — Clarify expected versus actual behavior
- User feedback: initial symptom descriptions did not explain what was wrong or how behavior differed from expectations.
- Added scenario-owned `briefing` data: baseline conditions, expected behavior, reported actual behavior, investigation focus, and first measurement procedure.
- UI now shows expected/actual side by side, stacking on narrow screens. Reports are explicitly historical initial-condition results, separate from live measured values.
- Periodic scenario: normal X range 8–10 versus faulty range 2–10. Ordinary periodic changes themselves are not the anomaly.
- Delayed scenario: normal first switch at t=8 versus faulty t=24. The anomaly is the late response, not the final value 4.
- Tutorial explicitly states no fault and explains the expected 3-step propagation.
- Added simulation-backed assertions for displayed ranges and switch times. `npm test`: PASS, 17 tests.
- `npm run build`: PASS. Browser verified tutorial and delayed expected/actual panels; captured `docs/behavior-comparison.jpg`.
- Revised delayed scenario headline to match the comparison: late switching is the anomaly.

## 2026-10-16 — Requirements v1.1 / larger investigations (started)
- User requests updated spec implementation and at least ~20 nodes per sample investigation.
- v1.1 replaces answer submission with direct node/connection editing + automatic repair validation (required repairs AND healthy outputs over stable window AND protected parameters).
- Plan: 24 nodes per investigation; retain 3-node tutorial per spec. Meaningful additional resource branches, monitoring paths and filtered outputs; navigable scalable graph.
- Faults on editable parameters will be materialized into the simulation parameters, allowing genuine repair without editing fault flags. Retain generic runtime faults for other modes.
- Preserve expected/actual briefings; replace obsolete submission UX, tests, save schema and docs. No agents delegated.

## v1.1 core + expanded content implemented
- Added declarative requiredRepairs/protectedTargets/outputChecks plus settleSteps/stableSteps. Verification runs on each real tick, only after edits; all criteria must hold continuously. Any edit restarts the verification window.
- Faults can now materialize an editable parameter once. N06 load fault is condition/time-triggered, E04 gain fault is initially present; editing actual parameters resolves mechanics without changing fault flags.
- Added generic direct editor on every node and connection, experiment/setting-correction intention in history, automatic completion, distinct confirmed reveal (not completion), and restart preserving settings.
- Removed answer target/mode UI and judge function. Session snapshots use v2 key, leaving v1 saves untouched but intentionally incompatible.
- Both investigations now have 24 nodes; periodic has two load periods (12 and18); delayed has a real 0.05 drain plus lagged monitors and independent decoy chain.
- Expected/actual reports updated and model-tested: periodic normal7.5–10 vs faulty1.5–10; delayed normal switch t9 vs faulty t31.
- Added zoom/scroll and node/edge selector for large graphs, expanded hit areas and keyboard selection; all node/edge signals actively measurable.
- Extracted App, Graph, Editor components. Automated initial-UI tests assert no answer form, no exposed solution, hidden-edge topology withheld, all24 nodes initially unknown.
- `npm test`: 33 tests passed prior to additional A/B compensation regression; pending final run. Next: browser QA, docs/evaluation rewrite, final checks.

## v1.1 verification and completion
- `npm test`: PASS, 34 tests (30 engine/scenario and4 initial-UI checks).
- Final `npm run build`: PASS, TypeScript + Vite production bundle. Dependencies unchanged, no reinstall required.
- Added explicit A/B regression: faulty source gain0.5 + healthy downstream gain2 restores output but cannot clear; repairing source with residual downstream compensation also cannot clear; restoring downstream gain permits clear.
- Browser tutorial: edited N01.level16, automatic completion at t9, no answer submission.
- Browser periodic: measured X/Y, edited capacity16 (no clear), repaired N06.load2 while compensation remained (no clear), restored capacity10 and advanced60 ticks (automatic clear).
- Browser delayed: repaired E04.gain1, saved, full reset, loaded, restarted preserving edits, and verified automatic clear at t72.
- Confirmed reveal requires a confirmation and displays REVEALED / 未クリア rather than setting completion.
- Browser console error logs empty. At390px, selected/measured N24; document clientWidth375 == scrollWidth375. Restored normal viewport.
- Added initial fit + explicit full-view control after visual inspection. Final screenshot `docs/gameplay-v11.jpg` saved and visually reviewed.
- Rewrote README and POC_EVALUATION for direct repair flow, 24-node scenarios, validation constraints, save-format change, and evaluation caveats.
- Remaining SHOULD: graphical causal-map notes. Automated interaction E2E is not included; initial rendering is automatically tested and interaction flows above were browser-tested manually.
- Resume: current canonical UI is src/App.tsx + Graph.tsx + Editor.tsx; src/main.tsx only mounts App. `npm run dev` starts locally. Use `npm test` before changing engine or scenario data. v2 snapshots retain actual parameters, edits, applied parameter faults, and verification counters.

## 2026-10-16 — Abstract explanation of expected behavior
- User feedback: expected behavior listed individual numeric examples instead of explaining the system generally.
- Replaced expected text in all scenarios with input/output relationships and timing principles; no concrete node IDs or numeric examples in expected behavior.
- Added scenario-owned expectedFlow and a simple behavior diagram: tutorial input → proportional transformation → delayed output; investigations use public high-level behavior without revealing hidden causal topology.
- Diagram explicitly distinguished from the node/connection graph. Actual symptom measurements and concrete operation instructions retained separately.
- Pending: existing tests/build and visual verification.
- Verification complete: existing34 tests PASS; TypeScript/Vite build PASS. Browser confirmed diagram and qualitative expected text, screenshot `docs/expected-behavior.jpg` reviewed.

## 2026-10-16 — Clarify normal tutorial status
- User correctly questioned why the tutorial's "actual symptoms" said behavior was expected.
- Tutorial is intentionally fault-free. Added scenario-owned actualLabel and changed its title to "現在の状態（正常）"; body explicitly says there is no anomaly and the purpose is practicing observation/editing.
- Investigations retain "実際の動作（今回の症状）". Updated existing UI assertions to use scenario labels.
- Verification:34 tests PASS; TypeScript/Vite build PASS. Text/label-only change, existing render checks cover all3 scenarios.

## 2026-10-16 — Describe actual symptoms in direct comparison to normal behavior
- User feedback: actual symptoms still failed to explain how they differed from expected behavior.
- Rewrote each investigation's actual description as normal behavior → observed departure → precise abnormal aspect (excessive amplitude vs excessive response time).
- Moved numeric observations into a separate optional actualEvidence paragraph with both healthy and faulty values side by side. Expected behavior remains qualitative per prior request.
- Tutorial explicitly states no difference. Investigation-focus text now asks about the identified difference, rather than repeating isolated measurements.
- Pending existing checks; no simulation behavior changed.
- Verification complete:34 existing tests PASS; TypeScript/Vite production build PASS. Changes limited to briefing text and evidence presentation.

## 2026-10-16 — Concrete actual behavior, abstract expected behavior
- User clarified that only expected behavior should be abstract. Prior revision incorrectly generalized actual symptoms too.
- Actual descriptions now specify observed targets, values and timing and compare them directly with normal measurements. Expected text/diagrams remain abstract.
- Periodic: N04 normal7.5–10 vs faulty minimum1.5; N08 normal0–2 vs faulty maximum8.
- Delayed: explicitly N04 stays10 through t30, changes to4 at t31 rather than normal t9;22-step delay. Explicitly scoped to main output, not every node.
- Tutorial actual behavior now gives the concrete N01/N02/N03 propagation sequence and states no fault.
- Verification: existing34 tests PASS, TypeScript/Vite build PASS. No model or expected-behavior changes.

## 2026-10-16 — Explicit user/system interface (started)
- User approved introducing input/output/inner node roles and separating ordinary input from diagnostic/repair edits.
- Plan: declarative manual inputs and typed node roles, dedicated input/output console, role indicators on graph, and input events distinct from edits.
- Delayed scenario will receive an explicit manual start input; symptom timing will be measured from that operation, not vaguely from reset. Retain24 nodes per investigation.
- Expected behavior remains qualitative; actual reports will name the input operation, output node, timing/value differences. Update tests, docs and snapshot version.

## Interface implementation and first verification
- Added typed NodeKind and ManualInput definitions, setInput API and inputEvents, with schema validation and a separate writable boundary from interventions.
- Added SystemInterface console with manual inputs and always-observed output values. Output timeline capture starts at session start; inner signals remain opt-in.
- Graph now differentiates input/output/inner by labels and color; target menu grouped by role. Existing direct editor explicitly labeled as diagnostic/repair editing.
- Delayed N01 is a manual start gate (initially0); it gates internal activity and main output feedback. Added a control edge, retained24 nodes.
- Delayed onset now11 healthy /33 faulty steps after manual start; idle input leaves X10 and accumulation0. Existing model tests updated to explicitly start the system.
- Snapshots use v3; prior v1/v2 keys untouched. Ordinary input and repair histories remain distinct, including restart-origin input timestamps.
- First existing34 tests PASS; added boundary, wait-before-start, input-history and UI-role regressions pending final run.

## Interface completion / handoff
- Final `npm test`: PASS,44 tests (36 model/scenario +8 UI). Final TypeScript/Vite build PASS.
- Browser: tutorial input level16 -> output8 -> automatic tutorial completion; ordinary input never appears as a repair edit.
- Browser: delayed scenario waited36 steps before manual start; output stayed10. After start +12 still10, after +36 output4. Input history records start at t36 rather than reset time.
- Browser: start input + E04 gain repair, save v3, full reset, load, restart preserving settings -> automatic clear after72 ticks; output4. Repair and input paths remain distinct.
- At390px, changed ordinary input and selected N24; document375px == scrollWidth375px. Restored viewport. Console error log empty.
- Captured and visually reviewed `docs/system-interface.jpg` (roles, input/output console,24-node graph, output timelines).
- Updated README and POC_EVALUATION to define boundaries, manual-only input support, concrete input-triggered reports, v3 save compatibility and current tests.
- An existing server occupied5173; QA used a new owned server on5174. Existing5173 process left untouched.
- Next optional items: automatic/conditional input node types, graphical causal notes, automated browser interactions. No required implementation work remains for this request.

## 2026-10-16 — Outputs must be terminal and in the last column
- User identified internal processing placed after output nodes. Moved outputs to a shared rightmost column in both24-node investigations (tutorial already terminal).
- Rewired monitors to branch from pre-output inner signals, adding one connection-delay step to preserve the old monitor timing. Outputs no longer feed any node.
- Added schema rejection of outgoing connections from output nodes; graph canvas derives bounds from actual positions and routes long horizontal edges around intervening nodes.
- Added terminal-layout and schema regression tests, plus90-tick equivalence checks against the prior monitoring topology for normal scenario settings.
- Verification complete:47 tests PASS; TypeScript/Vite build PASS. Browser verified periodic outputs share the rightmost column with no outgoing edges; long terminal links avoid intervening nodes. Console errors empty. Screenshot `docs/terminal-outputs.jpg` saved.
- Updated README with terminal-output rule and latest tests. Save format is nowv4 because previous snapshots contain delays for the pre-terminal topology; v1/v2/v3 slots left untouched but not loaded.

## 2026-10-16 — Implement specified trigger semantics (started)
- User authorizes implementation of input manual/timer and inner request/input/timer triggers, with terminal output nodes.
- Replace unconditional every-tick evaluation with deterministic event delivery; identical-valued arrivals still trigger input processors independently. No join/change-detection semantics.
- Timer periods are separate editable properties. Request-trigger inner nodes act as shared data providers; consumers fetch when their own processing starts. No new node kinds.
- Keep24-node investigations and repair validation, update reports to measured event-engine behavior, publish processing/trigger/property/fetch information in inspector, and maintain handoff log.

## Trigger engine and UI implemented
- Event queue: manual changes emit once on next tick; timer emissions follow a separate integer interval property; every delivered input activates an input-trigger inner (including equal values and multiple arrivals in one tick).
- Request-trigger inner is evaluated synchronously only on demand. Incoming request edges are fetched when the consumer starts processing; trace records requester/provider/value/version. Query cycles are rejected. Ordinary cyclic edges always deliver at least one tick later.
- Timer handlers run after due arrivals in canonical node-ID order. Edges and requests use canonical connection-ID order; no registration-order dependence. Queue/activation bounds and atomic state updates prevent hangs/partial worlds.
- Added editable inner local state, separate from configuration parameters and repair evidence. Parameter-only repair criteria remain strict; temporary state edits do not repair a fault.
- Scenarios remain24 nodes each. Periodic has timer input and shared request-provider N13 fetched by N14/N15. Delayed has shared request-provider N16 fetched by N15/N17. No extra node types added. Outputs remain terminal/rightmost.
- Input nodes output exactly their configured value; output nodes only retain arrivals. Removed irrelevant gain controls on those roles.
- Inspector now shows trigger semantics, formula, timer next-due, request dependencies, activation counts and recent fetch/version history. Shared providers can be queried for inspection. State fields use state storage correctly.
- Snapshot v5 now includes event queue, sequence, timer phase, signal memory, versions and trace. Previous v4 keys untouched.
- Existing tests ported where unconditional-tick assumptions were obsolete; new contract tests cover each specified trigger, shared-data timing, state editing, replay and atomic failures.64 tests PASS before final UI assertions; build PASS.

## Trigger implementation completed / handoff
- Final `npm test`: PASS,66 tests (56 model/scenario +10 UI). Final TypeScript/Vite production build PASS.
- Browser verified tutorial manual input emits once and completes; periodic input interval3 applies independently of value10; N13 request-inner responds on explicit inquiry.
- Browser shared-data test: edited N13.level2→3; N14's next timer activation fetched3 with an increased provider revision, while prior fetch records remained2/revision0.
- Browser local-state test: N06.state.value manually set2; next timer updated it to1.95. State storage and parameter storage remained separate.
- Browser snapshot v5: saved an in-flight delayed session with pending events and E04 gain repair, reset, loaded, advanced72 ticks -> automatic clear. No answer form or new node kinds introduced.
- At390px, state editor usable and document375px == scrollWidth375px. Returned viewport to normal. Console errors empty.
- Screenshots saved: docs/trigger-processing.jpg (full page), docs/trigger-inspector.jpg (graph/inspector viewport). Browser preview visually inspected.
- README rewritten for exact trigger semantics, request timing, same-value arrivals, state editing, timer phase, limits and v5 compatibility. Evaluation updated, explicitly no new shared-data-race investigation added.
- Existing5173 server left untouched; owned QA server ran on5174 and is stopped at handoff.
- Resume: read README then engine.ts (event model). Most test helpers activate the delayed scenario explicitly; no engine scenario-ID branch exists. Scenario data configures trigger types and intervals. Use `npm test` before changing timing rules. Processing and fetch details live in NodeDetails.tsx.
- Optional future: user-editable trigger types, asynchronous request latency, input join semantics, graphical causal notes, automated interactive browser E2E. These are not part of the requested trigger behavior.

## Graph input/output UI update (2026-10-16)
- User request: edit input properties directly on graph, always show output values, remove separate interface section.
- Input cards now embed validated property fields in SVG foreignObject, including independent timer interval. Retained explicit apply/Enter behavior and separate input history.
- Reserved space for input cards; terminal outputs remain rightmost. Output labels read current received state, independent of stale or cleared measurement history; inner nodes remain opt-in measurements.
- Removed SystemInterface component and updated tutorial, scenario guidance, README and editor copy. Save schema remains v5; event engine unchanged.
- Production build PASS. UI tests updated and live/stale output regression added; final verification pending below.
- Final verification:67 tests PASS; TypeScript/Vite production build PASS. Browser verified graph manual input16 via Enter -> output8.00 and automatic tutorial completion; periodic interval3 changes independently of capacity10. Both output nodes visible initially; browser console errors empty.
- Screenshot: docs/graph-input-output.jpg. Owned QA server5174 stopped; existing5173 untouched. Resume with Graph.tsx for UI; input fields reuse Editor.Field validation, output values read received World state.

## Node popup and drag navigation (2026-10-16)
- Request: click graph nodes for popup details; drag graph to scroll.
- Implemented native modal dialog for existing measurement, processing and editing inspector. Graph now uses full workspace width; node selection and keyboard activation open details. Input heading opens details while property fields stay directly editable.
- Popup supports close button, Escape, backdrop dismissal and native focus containment/restoration. Scenario/load changes close it; result dialogs dismiss it.
- Pointer capture implements background drag in both axes, ignores nodes/edges/forms, and cleans up on release/cancel/lost capture. Touch supported.
- Verification pending.
- Verified:67 tests PASS and production build PASS. Fixed existing UI regression test union typing exposed by TypeScript build. Browser: N02 click opens correct processing/measurement/editor popup; Escape closes; background drag moved scrollLeft0→250 and scrollTop0→50; release cleared grabbing state. Screenshot docs/node-popup.jpg. No engine/save changes. Owned5174 server stopped;5173 untouched.

## Non-modal node popover (2026-10-16)
- User correction: use a popover instead of a modal popup. Replaced showModal dialog with native manual Popover API, no dimming or focus trap.
- Position beside selected graph node/edge, flip left and clamp to viewport at edges; reposition on scroll/resize/content size changes. Compact440px panel with internal scrolling.
- Other nodes remain clickable to switch details; input forms and graph remain interactive. Outside pointer, Escape and close button dismiss.
- Verification pending.
- Verification complete:67 tests PASS, TypeScript/Vite build PASS. Browser verified adjacent N02 popover, switching directly to N01 while open, and editing graph input8→12 with popover still open. Console errors empty. Screenshot docs/node-popover.jpg. QA server5174 stopped; existing5173 unchanged.

## Values at connection ports (2026-10-16)
- User request: distinguish received input values and produced output values by positioning labels at connected endpoints.
- Removed ambiguous center value. Each visible connection now has IN at receiving endpoint and OUT at emitting endpoint, with dots and distinct colors. Column spacing increased to accommodate labels. Multiple inputs are labelled independently per connection and accessible labels include connection/input IDs.
- Internal IN uses measured connection values; OUT uses measured node values. Unmeasured values stay ?. Public input emission and output received values remain visible. No engine/save changes.
- Verification: production build PASS;67 prior tests PASS. Added regression for incoming8 versus emitted4 at N02's distinct endpoints, plus removal of center label.

## Clarify range limiting (2026-10-16)
- User could not interpret the opaque 範囲制限(...) expression. Added named target/lower/upper arguments and contextual explanation using each expression's actual bounds.
- Explanation covers below/above bounds, inclusive unchanged interior and evaluation before the enclosing expression. It does not reveal unmeasured values or change engine behavior.
- Verification:68 tests PASS; TypeScript/Vite production build PASS. UI explanation only; no engine or snapshot changes.

## Compact mathematical notation (2026-10-16)
- User rejected lengthy named-argument range explanations. Removed the added explanatory block and replaced clamp with max(lower, min(value, upper)).
- Display sums containing -1 × term as subtraction, making the reported rule state.value ← (param.gain × max(0, min((input.supply − input.load), 30))). Evaluation unchanged.
- Verification:68 tests PASS; production build PASS. Display-only change, no engine behavior changes.

## Always-on observations (2026-10-16)
- User removed manual observation workflow. All configured observations now sampled automatically from initial time, on each step, reset, scenario change and restart. Removed measurement-start buttons.
- Old v5 saves retain recorded history; append a full current sample when loading, ignoring prior restricted measurement selection. Missing past data is not fabricated. Observation permission/availability/period/noise semantics unchanged. Request inspection remains an explicit node trigger, not a measurement-enable action.
- Graph input/output endpoint labels now populated without clicking observe; hidden connection topology remains hidden. README and tutorial updated.
- Verification:68 tests PASS; production build PASS. Initial rendering assertions now check auto-observed endpoint values and absence of manual measurement buttons for all scenarios. Engine and save schema unchanged.

## Remove output-independent branches (2026-10-16)
- Latest user instruction takes precedence over earlier minimum20 nodes. Removed independent monitoring/decoy branches rather than inventing output dependencies. Periodic now12 nodes (N01–N12); delayed now11 (N01–N07,N09–N12).
- Removed dead edges, observation/editor/protection entries and delayed N18 verification check via scenario regeneration. Updated descriptions/hints/explanations. Core faulty/normal output behavior unchanged.
- Save schema/key v6 because old pending events can target removed nodes. v5 storage untouched, not loaded.
- Added regression requiring every retained node to reach an output and no dangling observation/edit/verification targets.
- Final verification:68 tests PASS; production build PASS. Normal/faulty output ranges and delayed11/33-step onset, repair clearance and replay tests pass after pruning. Protected-edit test now modifies retained drain N09 instead of removed decoy N08. Removed empty monitoring columns; outputs remain rightmost at x790.

## Resolve formula input symbols to nodes (2026-10-16)
- User request: show concrete node IDs instead of unexplained input.supply/input.load names. Formula references now resolve from actual incoming connections. Own params/state use own node ID; one source uses its ID, shared input slot uses latest(source IDs), request source uses fetch(ID).
- Important: periodic N02.input.load is shared by N06/E07 and N12/E11; engine uses last arrival, not sum. Display explicitly preserves this semantics. Compact legend clarifies received values after connection coefficients, latest arrival, fetch and prior local state.
- Verification:69 tests PASS including actual N02 formula sender resolution; production build PASS. Display-only, engine unchanged.

## Correct formula/graph consistency (2026-10-16)
- User saw N07 apparently connected to N02 while formula names N06/N12. Actual edges are E07 N06→N02 and E11 N12→N02; no N07→N02 edge.
- Found stale hidden-edge scenario setting masking E07. Removed it; all periodic causal connections now visible. Routed cross-row/column lines through spaces between node rows/columns so E11 avoids N07. Edge tooltips identify exact endpoints.
- Updated regressions to require both E07/E11 visible and no N07→N02. Engine semantics unchanged.
- Verification:69 tests PASS; production build PASS.

## Circular boundary ports (2026-10-16)
- User supplied visual reference: values in circular ports embedded in node border; node kind/ID central.
- Implemented120×80 node body, per-connection input circles on left/top/bottom according to source direction, one right-side output circle. Each incoming connection has its own port (even shared engine input slots). Lines terminate at circle edges; arrow directions enter inputs. Input property card retained with right-side output circle.
- Removed IN/OUT text labels outside lines; circle numbers omit unnecessary trailing zeros. Connection tooltips/accessibility labels retain endpoint identity.
- Verification:69 tests PASS; production build PASS. Browser at periodic t12 shows N02 left input, two distinct bottom input circles and right output circle; edges enter exact circles and N07 is not crossed. Browser console errors empty. Screenshot docs/circular-ports.jpg. Owned QA server5173 stopped.

## Atomic computation port display (2026-10-16)
- Request: display input/output as one atomic set after processing completes. Added per-node computation frames containing consumed per-connection inputs, resulting output and completion time. Graph now reads both sides from the same frame, not current sent-edge observations.
- Frames commit on successful processing (including timer/request), manual/timer input emission and output receipt; deliveries to inactive timer/request nodes leave displayed pair unchanged. State/parameter edits do not replace a completed computation display. Initial frames are explicitly initial values (time null).
- Persistence v7 stores frames; previous v6 storage untouched.
- Found prior formula explanation incorrect: engine inputsFor SUMS multiple connections sharing input name. Fixed displayed formula to N01 − (N06 + N12), preserving engine behavior. Prior latest(...) display/log explanation was wrong.
- Verification complete:71 tests PASS; production build PASS. New regressions cover delivered input16 while timer frame remains8→4, then atomic16→8 at t4; manual state edit keeps prior display pair; snapshot replay preserves frames; failed calculation does not mutate prior frames.

## Explicit output requirements and healthy outputs (2026-10-16)
- Scope: user authorized clearer expected behavior + additional output nodes, including unaffected outputs. Existing root/protected-setting grading remains; alternative-repair grading and graph editing are not implemented in this request.
- Added structured per-output requirements table (condition, expected values/timing/phase/hold, reported normal/abnormal behavior). Main expected paragraphs remain system-level, no individual worked examples.
- Periodic adds terminal N13 activityA notification (N05), N14 activityB notification (N12). Delayed adds terminal N13 start acknowledgement (N01), N14 constant drain (N12). All outputs rightmost; existing nodes still contribute to outputs.14/13 nodes respectively.
- Regenerated controls, observations, protected settings and output checks. Healthy signals are independent of injected faults. Primary symptom timings/ranges should remain unchanged.
- Save schema v8 because new node/edge/frame state is required; v7 storage untouched. Verification pending.
- Final verification:75 tests PASS; production build PASS. Added tests for all outputs having one requirement row, periodic healthy output phase/width over180 steps with/without fault, normal residual range across C0/1/4/10/20, Y=2×delayed activityA, delayed healthy outputs at start times0/17/50 and stop acknowledgement.
- Browser verified periodic requirement table and four rightmost outputs. Delayed at start+12: faulty X10, healthy acknowledgement1, healthy drain−0.05. Console errors empty. Screenshots docs/output-requirements.jpg (full page) and docs/output-contracts-table.jpg (table). Owned QA server5174 stopped; existing5173 untouched.
- Handoff: contracts in Scenario.outputRequirements; graph topology/outputs configured before editors() so all new edges have controls/protection. No multi-input acceptance grader or graph connection editing added.

## Read-only external disturbance INPUT (2026-10-17)
- User authorized external-input nodes: player cannot operate/edit node; observation/history allowed. Implementing seeded uniform/fixed value generation independently from periodic/random-interval trigger. RNG streams per-node and separate value/timing state; persisted for exact resume, reset/restart replay.
- Integrated periodic scenario with external load N15 (uniform0–0.4, random3–7-step intervals), internal load subtraction N16, output N17 usable residual and normal output N18 disturbance notification. Existing primary symptom/ranges unchanged; new contract7.1–10 for N17 at supply10.18 nodes total; all reach terminal outputs.
- UI marks external input read-only; no fields/editor controls. Runtime setInput/intervene and scenario validation enforce lock. Internal downstream settings remain editable.
- Save v9 includes RNG state; previous slots untouched. Verification in progress.
- Browser verified at t36/t48: external card has no input fields, detail shows generator/seed/next due and no editor; source values propagate through N16 to N17 and N18. Saved at36, advanced12, reset/loaded/advanced12 -> same displayed0.19. Console errors empty.
- Screenshots docs/external-input-readonly.jpg and docs/external-input-graph.jpg. README documents semantics, schema and read-only boundary. Existing5173 left untouched; own QA server5174 stopped at handoff.
- Final verification:83 tests PASS; TypeScript/Vite production build PASS. Coverage includes random/periodic × uniform/fixed, bounds, seed/reset/restart/replay/order independence, forged-control rejection, invalid definitions, output propagation/repair, and atomic rollback of RNG when later processing fails.
- Resume: externalInput/Trigger/World.random in engine.ts; scenario integration after configure(nodes1) and before editors(); UI read-only card in Graph.tsx, details in NodeDetails.tsx and editor guard in Editor.tsx. Player-editable connection settings remain existing behavior; user locked the external INPUT node itself.

## Output-contract monitoring and acceptance (2026-10-17)
- User authorized live output anomaly popovers + onset/recovery log + collapsed requirements without fixed reproduction state; replacement of root/protected-setting grading with public behavior acceptance.
- Added declarative output rules in contracts.ts, shared by monitor and candidate validation. Rules cover exact input/output relations, periodic phases, deadlines and constant/externally supplied outputs; strengthened residual-output relation to prevent constant-output bypass.
- Public behavior cases vary input amplitudes, start/stop timing and disturbance seeds. Candidate settings are tested from fresh state, using output behavior only; no required-repair/protected-parameter comparisons.
- Added non-modal automatic per-output alerts and persistent transition logs, collapsed condition table with executable rule labels and public case list. Save v10 includes monitor/history/logs. Verification in progress.
- Removed legacy requiredRepairs/protectedTargets/outputChecks and fixed symptom fields from current scenario schema/data. Historical WORK_LOG entries describe old behavior only; current acceptance no longer references cause metadata.
- Browser verified delayed output alert at t12 (onset t11, expected4 actual10), automatic removal at t33 with recovery retained in bottom log, and N05.level5 compensation clearing at t72 while original E04 gain remains0.2. Condition table is collapsed initially.
- Final verification:90 tests PASS; production build PASS without warnings after restoring the stylesheet from an accidental overwrite during final UI cleanup. Browser rechecked the restored layout. Focused UI/contract checks21 PASS after final presentation cleanup.
- Added coverage for same-rule monitor/acceptance, onset persistence and late recovery11→33, recurring alarms without per-tick spam, snapshot logs, candidate-world immutability, equivalent connection/upstream compensation, bad constant/timing behavior, and absence of fixed reproduction text / initial collapsed requirements.
- Browser also confirmed simultaneous N04/N08/N17 alerts, saved/restored alarms and history in v10, no console errors. Screenshots docs/output-anomaly-popover.jpg, docs/output-anomalies-periodic.jpg, docs/output-anomaly-log.jpg.
- Handoff: contracts.ts defines reusable public expressions/rules/monitor; scenarios.ts supplies tr/pr/dr rules and explicit input/seed cases; engine.validateBehavior runs candidate settings in isolated fresh worlds and uses checkOutputs, same as live monitor. Failure cache includes parameters and user state edits. OutputAlerts.tsx uses independent native non-modal popovers anchored to visible graph outputs, repositions on scroll/zoom/resize.
- Known scope: finite, fully published case coverage; not formal proof for all possible inputs. Existing editing capabilities unchanged (no add/rewire graph UI). External INPUT remains locked. Full reset clears anomaly history; save/load preserves it.
- Owned QA server5173 stopped at handoff.

## Remove reset prerequisites from instructions (2026-10-17)
- Removed reset-required wording from delayed input description, output conditions, briefing and first action; start-relative timing now refers directly to N01 changing0→1.
- Periodic output conditions refer to displayed simulation time; experimental comparison instructions no longer ask for a reset. Explicit reset button and automatic isolated verification-case behavior remain available. Engine unchanged.

## Replace unexplained scenario vocabulary (2026-10-17)
- User rejected invented terms such as 開始入力/停止入力. Reviewed all scenario conditions, expected behavior, briefings, hints, node descriptions, case names, formula labels and current README.
- Input fields now show actual property names level/capacity/interval/enabled. Delayed behavior explicitly states changes to N01.enabled, the input-apply action, and values/timing of N04/N13/N14. Removed ungrounded 開始受付/準備完了/活動A/B/残量X aliases in favor of actual node IDs and numeric behavior.
- Replaced opaque expression display functions 追従/条件/周期信号 with their arithmetic/conditional forms; rule pulse display likewise shows its actual conditional expression. Evaluator and timing unchanged; no save-format change.
- Focused UI/behavior tests21 PASS; production build PASS before final full verification.
- Final verification:90 tests PASS; production build PASS. Final focused UI checks15 PASS after aligning input formula labels with node.property IDs. Text/formula-rendering changes only; simulation and monitoring rules unchanged. All current UI/source descriptions and README checked for the rejected aliases.

## Readable processing formula steps (2026-10-17)
- User requested intermediate assignments instead of deeply nested processing formulas. NodeDetails now renders a preformatted calculation sequence with operation-based names (差分, 上限適用後, 下限適用後, 選択値), retaining node/property IDs and source-reference resolution.
- Clamp expands into min followed by max; repeated intermediate names receive numeric suffixes. Simple references stay a single assignment. Each update expression has its own intermediate scope, and state references still refer to pre-processing state. Simulation/evaluator unchanged; no save migration.
- Added regression coverage for the requested nested conditional/clamp example, multiple clamp branches with distinct names, resolved multi-source references, and simple references. Production build PASS; full tests running.
- Final verification: all93 tests PASS (including existing UI/source-ID assertions); production build PASS. Handoff: processingText in src/NodeDetails.tsx is the display-only AST-to-steps formatter; processing-rule CSS preserves newlines and wraps long lines inside the existing popover.

## English intermediate variable names (2026-10-17)
- User requested English variable names to avoid suggesting Japanese game terminology. Changed all generated intermediate identifiers to English operation names: difference, upperClamped, clamped, selectedValue, sum, product, comparison, sumValue, interpolatedValue, pulseValue, inputValue. Numeric suffixes still distinguish repeated operations.
- Updated formatter expectations. Focused formatter/UI tests18 PASS; production build PASS. Display-only change; evaluator unchanged.

## Distinguish retained state and output (2026-10-17)
- User identified ambiguous N06.value, which represented previous internal state on RHS and updated state on LHS, not a configurable parameter. Formula display now explicitly uses node.state.key for state reads/updates, retains node.parameter for configuration, and separately shows node.output = node.state.value.
- Brief legend distinguishes previous retained value (initial value on first execution), updated state and output. Engine already evaluates all updates against pre-computation state; unchanged.
- Added actual delayed N06 regression asserting state read, state update, output assignment and absence of ambiguous N06.value. Focused tests19 PASS; production build PASS.

## Connections express relationships only (2026-10-17)
- User explicitly rejected computation on connections. Removed connection gain, delaySteps, custom state and source-state key from Connection schema and scenario constructors. Connections transport node output unchanged; enabled only represents existence of the relationship. Read-only edge observations retain transported values for investigation.
- Both event delivery and synchronous requests now pass the source output without edge arithmetic. Common next-tick event scheduling remains; any runtime delay fault belongs to its source node. Schema rejects processing fields, faults targeting edges and processing editors on edges.
- Moved delayed scenario's F02 gain reduction from E04 to N05.gain; N05's displayed formula and parameter now account for the reduction. E04 transparently passes N05 output. Output contracts and expected11/faulty33 step switching remain unchanged; cause explanation updated to N05. Alternative node-property compensation still accepted by behavior only.
- Removed connection gain/delay controls; preserved enabled as relationship editing. Save format now v11, separate from old v10 slot (old data preserved, not loaded into incompatible simulation). README and formula legend updated.
- Initial full run exposed one obsolete test for edge-gain compensation; replaced it with node gain/load compensation acceptance and overcompensation rejection. Added unchanged event-value/delivery regression, schema rejection and connection editor regression. Verification in progress.
- Final verification: full suite96 PASS; production build PASS. Final UI-only suite17 PASS after adding the connection editor regression (97 tests now defined overall). Existing healthy/faulty timing, automatic acceptance, synchronous request, atomic frames, disturbance replay and anomaly-log tests all passed. No browser UI session performed for this change; rendered markup regression verifies removed connection controls.
- Handoff: connection mutable settings now contain only enabled. N05.gain is0.2 in faulty delayed worlds and1 after direct repair; N05.level5 is still a valid equivalent compensation. No edge gain/delay migration is attempted; v10 snapshots remain in their old slot, v11 is used for future save/load.

## Implementation and text consistency audit (2026-10-17)
- Reviewed engine/contracts, all scenarios, graph and node details, editor, App/save/restart, anomaly UI and README. Review report: docs/IMPLEMENTATION_REVIEW.md.
- Reproduced three defects with failing audit tests: disabled edges retained inputs/queued deliveries; restart lost manual initial-state edits unlike acceptance; changed configuration/input retained stale lastValidation. Fixed and retained regressions.
- Added common relation initialization (including read-only edge measurements and frames) and common manual-state initial configuration for restart/acceptance. Disabling relations clears cached values and pending deliveries without rewriting completed computation frames. Current formulas omit disabled sources; graph labels disabled relations explicitly.
- Reproduced healthy delayed repeated-input mismatch (1 at0,0 at30,1 at40: actual4 at44 vs expected10 until51). Added E25 N01→N06 and node-owned switch reset while N01 is0; public repeated-cycle test now passes. Existing11-step healthy/33-step faulty first response retained. Public behavior cases now include repeated1→0→1→0; repair equivalence remains based only on output conditions.
- Fixed tutorial hardcoded8/completion claims and no-fault heading, state edit history names, state-reference manual-edit semantics, verification wait/restart/inactive relation explanations, unsupported hidden-relation wording and README terminology. Replaced argument-spread chart bounds with reductions to avoid long-session argument-limit failures.
- Save formatv12 uses separate slot because E25 changes frame shape. Oldv11 slots preserved, incompatible snapshots not loaded. Existingv11 snapshots cannot be migrated by silently inventing historical received values.
- Full102 tests PASS; build PASS before final text/save-slot cleanup. Final focused/build verification pending. No browser manual QA in this audit; SSR checks cover formula/control text.
- Final focused25 tests PASS after save-slot/text cleanup and diagnostic-test rename to repeated-input.test.ts; final production build PASS. Overall suite remains102 tests (all passed in full run). Review complete; detailed evidence, fixes and limits recorded in docs/IMPLEMENTATION_REVIEW.md.

## Three additional investigations (2026-10-17)
- User requested2–3 more problems. Added three20-node/five-output scenarios: shared reference corruption, clipping that fails only for large inputs, and sampling that has correct final values but wrong response timing.
- Extracted existing scenario constructors into scenarioBuilders.ts without changing old graph definitions. additionalScenarios.ts defines new data; existing scenarios retain their IDs/order/save compatibility.
- All computations remain in nodes. N05 is a request-trigger shared property node with two consumers; source/output nodes and graph input controls use existing roles. N19/N20 supply independent healthy outputs. Every node contributes to an output; all outputs occupy the final column.
- Added public input-amplitude and phase-shifted change cases, exact output/lag contracts, hints, abstract expected behavior, concrete conditions and cause explanations. New threshold/switch contract expressions mirror node semantics and expose the actual comparison in condition labels.
- Regression verification in progress, including healthy/repaired public cases, small/large clipping, sampling onset/recovery, constant shortcuts, deterministic query/timer snapshots and UI rendering.
- Focused new-scenario/contract/UI suite43 PASS. Browser selected all six menu options; shared scenario shows N16/N17/N18 alarms with independent healthy N19/N20. Clipping scenario at level3 produces no alarms; changing to12 yields N18 expected6/actual2 and N16 expected10/actual4 with retained transition logs.
- Initial expanded full-suite process ended with SIGTERM143 and no test failure output. Running the engine suite separately to distinguish execution/resource interruption from regression.
- Browser sampling scenario: input14 causes N18 onsett4 (expected18 actual2), recoveryt6; N16/N17 onsett6 and recoveryt8. Saved sampling world, changed scenario and restored it successfully; changing N02.interval to1 and advancing36 opens VERIFIED completion. Screenshot docs/additional-sampling-log.jpg records the unrepaired onset/recovery log.
- Broadened old fault-transition test to compare all public outputs after an input operation instead of assuming every scenario's N04 is faulty. The first revision used input7, which does not cross the new sampling threshold; corrected it to the declared input maximum. Removed duplicate full healthy acceptance runs from this transition-only test after a5-second timeout; targeted rerun now passes in804ms. Full-suite rerun in progress.
- Final full verification: all121 tests PASS across7 files (27.78s); production build PASS. Browser confirmed menu selection for03–05, anomaly display/logs, small-vs-large clipping, sampling recovery, save/load and repaired automatic acceptance. Owned QA server5174 is being stopped at handoff; user's5173 tab/server was not modified.
- Handoff: new scenarios live in additionalScenarios.ts, common construction in scenarioBuilders.ts. Public behavior uses explicit input/lag formulas independent of faulty parameter values; threshold/switch expressions were added to contracts.ts. Existing scenario definitions andv12 save slot remain compatible. README and progress log updated.

## Publish initial GitHub commit (2026-10-17)
- User explicitly requested committing the implementation to https://github.com/AngryMane/engineer-game-poc.git. Verified repository is empty, public, default branch main, with push permission. Local .git is an empty read-only placeholder; publishing from a separate temporary checkout.
- Includes source,121-test suite, package manifests/lockfile, README, evaluation/review docs, screenshots and WORK_LOG. Excludes node_modules, dist, build metadata and environment-only .aws/.codex/.agents folders. Existing full121 tests and final build passed; no application changes since verification.
- Creating an initial main commit and pushing without force. Final remote SHA verification to be reported in chat.
