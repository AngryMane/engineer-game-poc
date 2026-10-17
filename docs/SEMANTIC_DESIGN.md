# Semantic model and Aha comparison

## Implementation boundaries

Simulation Core is unchanged in this revision. semanticModel.ts defines free-form module/port meaning; it has no supply/consumer node enum or execution hook. Hierarchy.semantics is optional authoring metadata. semanticPresentation.ts projects labels, mathematical port aliases and explanatory prose only. Existing hierarchy ownership, port bindings, visibility, expressions, parameters, triggers, faults, random streams and output contracts are shared between modes. moduleViewScenario reuses an already authored System hierarchy instead of generating a duplicate one.

07 / Two deviations is the first scenario authored for this comparison. Existing00–06 remain playable with their original presentations; the new model can be attached to other scenarios without engine changes. Both modes expose the same scopes, numbers, processing expressions and interventions. Mode A is the default. Mode B adds functional names, purposes, port roles, assumptions and constraints. Both use the same quantitative equations. Meaning is shown in module details and collapsed Spec inside visible module cards; hidden descendants are not rendered.

v14 saves optionally store displayMode. Old v14 saves default to abstract. Switching does not reset World, scope, selection, notes, experiments, layout, logs, hint count or RNG. Layout/selection identifiers remain stable across mode changes. Simulation Core does not read any functional name.

## Play and hypothesis path (contains solution)

At07, leave N01.level=10 and N02.level=2, change N03.enabled from0 to1, Apply, and advance5 ticks. In Mode A these are InputA, InputB, InputC; in Mode B: Supply, Request, Enable. Open Module B / Coordination to investigate its visible children.

System → Core/Coordination contains:

- Balance / Headroom monitor: estimates spare supply after converting requested usage and deducting external use. The estimate itself consumes no resource.
- Storage / Preparation buffer: while enabled, adds the spare amount to stored preparation, caps it at24, and resets it on disable. Ready follows actual stored charge with a delay.
- Accounting / Usage convention → Calibration / Usage reference: returns the same configured conversion factor to both callers. Its local spec does not reveal a fixed correct repair value.

Every one of15 execution nodes contributes to at least one output. There are no padding/distractor nodes. Two separate conversion nodes (N06 and N09) allow the monitoring and storage paths to be inspected or compensated independently; both query N05. Manual request/enable, periodic supply, seeded external use and independent request/external echoes distinguish causes. No factory, ship or other concrete theme is implemented.

### Facts → hypotheses → tests

1. Headroom falls below its contract, while charge grows too slowly. Under seed20261017 and Enable at t0, healthy Ready first becomes1 at t7; faulty Ready at t8. The amount and the duration look like different problems at the outputs.
2. ExternalEcho and RequestEcho remain correct. Ready also correctly follows the *actual* charge. This argues against broken request delivery, external measurement or the final threshold itself.
3. Functional specifications allow a new account: preparation takes longer because the available surplus is smaller, rather than because a timer runs slowly. The headroom estimate and accumulation can both be affected by how usage is counted.
4. Set Request to0, disable/re-enable preparation, then compare. The fault influence disappears at zero demand; increasing request increases both effects. Compare the headroom deficit and charge increments at aligned sample times. Changing supply alone is a competing hypothesis; external use is an observed confounder.
5. Drill into usage convention/reference to test the shared conversion hypothesis; or adjust one local correction and observe that only one branch improves. Direct repair N05.factor=1 or paired corrections N07.correction=N10.correction=0.5 pass all public cases. A one-branch fix, output freeze or prefilled-state-only shortcut fails.

No internal module is automatically marked faulty. No cause-selection or written-answer submission was added. Local module specs are investigation aids, not extra acceptance criteria; a compensating repair may violate a local nominal specification while satisfying System. Irrelevant state edits that are erased on the first disabled tick are intentionally allowed when the complete system behavior is correct.

## Quantitative specification and validation

System contracts use supply lag3, manual request lag4, external-source lag2 and enable lag3. The periodic supply phase differs from the manual input phase. Charge is a recurrence anchored to0 while disabled and bounded0–24, driven by the expected spare amount. Ready is threshold(actual charge[t−1],24), not an independent fixed deadline. RequestEcho and ExternalEcho have separate exact contracts. Twelve public cases cover supply4/8/12, request0/2/4, delayed enable, stop/restart, dynamic supply/request changes, supply exhaustion, idle and two external seeds. Exact cases prevent constant compensation and output freezing without requiring an exact cause edit.

Tests compare entire Worlds tick by tick across A, B and arbitrary renamed functional metadata, including a demand intervention and repair. They compare accepted repairs, scope membership, projected connection IDs/bindings, boundary samples and saved sessions. Existing regressions still run across the added scenario. One pre-existing generic test assumed N02 always had an editable gain; it now selects an actual inner-node gain while keeping its residual-edit assertion.

## Implementer evaluation (not player evidence)

- **Does naming generate hypotheses?** Plausibly: “preparation buffer” introduces a rate-versus-duration explanation, and “usage convention” suggests a shared accounting cause. This is an implementer judgment, not a measured effect.
- **Is it too obvious?** The names do not say which node is broken or what value fixes it. The shared query edges still offer a direct inspection shortcut. A player who opens every node can still solve it without an Aha moment.
- **Can players reason at module level?** They can compare headroom with charge increments and intervene on request without opening individual processing nodes. Mode A has the same numerical relations; B supplies the functional interpretation.
- **Must they combine facts?** Explaining the amount loss and duration change with one hypothesis benefits from combining facts. The game does not force that reasoning: blind search or independent local fixes remain possible and are accepted when correct.
- **Is this only hierarchy exploration?** No extra nesting/padding was added for difficulty, and meaningful experiments exist at the System inputs. Nonetheless, reverse tracing converges on a shared dependency. Requirement that this is *hard to notice by tracing alone* remains unproven until first-time testing. Do not claim improved Aesthetics from implementation checks.

## Player test plan / remaining questions

Use independent participants for A and B (or fresh counterbalanced scenarios); switching the same player from B back to A does not erase learned meaning. Keep numerical seed, graph, input setup and time budget fixed. Ask for spoken hypotheses before interventions without adding in-game answer grading. Record first multi-symptom hypothesis, evidence cited, interventions, number of expansions and repair type. Look for explanations based on spare capacity and accumulation rather than just finding the largest/oddest parameter. Also record cases where “usage convention” directly gives away the cause or players only traverse the graph.

No first-time player test has been conducted. No claim of a proven Aha improvement, unique intended reasoning path or optimal difficulty is made. Other existing scenarios have not yet been authored with complete A/B semantic metadata. Functional explanations may still be overly leading; terminology comprehension and the default disabled preparation input need player testing. Mathematical specifications are verified against healthy traces, but player comprehension is a separate question.
