# Reproduction scenario design (designer spoilers)

## Before implementation

Use existing timer, switch, and held state expressions; no sequence matcher or engine changes.

- Public inputs: level (0–16), Capture (0/1), Use (0/1). Capture=1 samples level each tick; Capture=0 retains the last acknowledged setting. Use=1 emits that retained setting; Use=0 emits zero. Initial retained setting is zero. Published end-to-end latencies include delivery and processing.
- Initial evidence: an acknowledged setting of 10 accompanied a result of 0 during use; another use produced 10; incomplete earlier records mention capture being disabled. Omit the complete input sequence and times.
- Mechanism: control acknowledges capture independently; holding stores the working setting; consumption uses that setting. Holding should retain it when both controls are zero. A faulty retention multiplier erases it during that idle state.
- Reproducer: Capture=1, allow capture, Capture=0 while Use=0, allow idle processing, then Use=1. The idle transition loses working state while final outputs still meet their specs. Only later use exposes the mismatch.
- Controls: no capture, capture only, use only, use before capture, keep capture enabled during use, simultaneous release/use, varied gaps and values, stop/restart and recapture. No fixed magic value is necessary.
- Repair: restore retention to 1. Alternative: consumption uses the independently acknowledged setting instead of the working copy. Grade both only against final output contracts, including changing levels, stops, and repeated capture.
- Experiments: snapshot the exact starting World (including RNG, queue, settings and state); record ordered input/edit/request actions with their ticks. Replay from that snapshot through normal engine APIs, never from current settings. Keep recipe and notes alongside all sampled histories. Allow a copied recipe's input timing/value to be edited.
- Presentation: keep report/evidence in a compact disclosure; do not expose acceptance-test operation sequences in this scenario's initial specification. Names and hierarchy remain presentation-only.

## Evaluation limits

This mechanism supports a falsifiable order/state hypothesis. Whether first-time players infer it from evidence, experience surprise, or instead brute-force node parameters requires independent playtesting. Implementation tests cannot establish Aha or engagement.

## Implemented mechanism and timing

08 has 8 necessary nodes, 10 unchanged-value connections, 3 inputs and 2 outputs. Control N04 and Holding N05 are timer computations that sample Level while Capture is 1. Control retains its acknowledged copy; Holding should retain its working copy. Consumption N06 reads the working copy while Use is 1. Acknowledged N07 and Result N08 are terminal outputs.

N05.retention normally equals 1. The declared start-time parameter fault multiplies it by 0. In the idle branch (Capture=0 and Use=0), N05 multiplies its held value by retention. With no previous capture both healthy and faulty values are 0. Capture alone acknowledges correctly and Result remains correctly 0. No operation list, special event matcher, latent-fault flag or scenario-specific engine rule exists.

Example reproducer (designer only): Capture=1 at t=0, Capture=0 at t=6, Use=1 at t=10. Working state becomes incorrect at t=8, while both final outputs remain correct. Result first differs at t=13 (expected 10, actual 0). Capture and Use's manual emission adds two ticks to consumption; final delivery adds one. Acknowledged[t] = Capture[t−3] ? Level[t−3] : Acknowledged[t−1]. Result[t] = Use[t−3] ? Acknowledged[t−1] : 0. Initial retained values are 0.

Holding's extra idle branch is the mechanism to investigate, not an additional normal behavior in its public spec. Healthy specifications consistently require retention, including across stops. Level can change after capture without altering the retained setting until capture is enabled again.

## Controls and repair acceptance

- Wait 40 ticks: no onset. Use only: 0 remains correct. Capture/release only: acknowledgment retained, Result=0 remains correct.
- Use before capture, Capture held during Use, and releasing Capture simultaneously with enabling Use: no onset.
- Release Capture while Use=0, then Use after gaps 1/3/9: onset. Varying the positive Level preserves the causal pattern; no particular numeric password is required.
- 18 acceptance cases cover idle, each control alone, reverse ordering, maintained capture, simultaneous release/use, levels 1/4/10/16 with gaps 1/4/10, stopping, changed levels and recapture.
- Direct repair: N05.retention=1. Alternative: N06.useAck=1 uses the already acknowledged setting. Both satisfy all final-output cases and can clear from an idle run without the player ever reproducing the defect. Prefilling working state or freezing the final processing gain at zero fails.

## Experiment persistence and replay

`experimentReplay.ts` executes recorded input, intervention and request actions through existing APIs. Its initial snapshot includes all state, timer phase, pending events, parameter edits, RNG streams and monitor history. Equal-tick actions preserve original ordering. `hierarchySession.ts` validates stored snapshots/actions, preserves v14 compatibility, and records the live run's baseline and pending action history. Presentational graph navigation, mode and layout do not enter recipes. Inspection requests do, because they execute code.

A replay runs to the recorded end tick, even if a clear check succeeds earlier; ordinary stepping still pauses at a newly achieved clear result. New variants are separate records and do not silently overwrite the live world. Notes and predictions are copied with them. Both successful observations and failed observations are available with identical controls. A normal experimental trace does not imply all acceptance cases pass; the UI's validation result remains distinct from live onset/recovery logs.

Older records have no replay snapshot; replay is unavailable for them. Loading an older live save starts the new recorder at the restored state. Existing history remains viewable. Long traces/snapshots are not compressed; localStorage capacity and synchronous large-recipe replay remain practical limits. No run-count, penalty or phase gate was added.

## Implementer assessment vs first-time tests

**Implementer assessment:** The healthy acknowledgment paired with a later zero result contradicts the simple hypothesis that capture never happened. Comparing use-first and capture/release-first experiments isolates the importance of the idle interval. Keeping the acknowledgment and working retention in different modules lets a player hypothesize a lifecycle/retention problem before opening individual nodes. The mechanism uses meaningful state; irrelevant nodes and chance do not create difficulty.

**Risks:** Only three inner nodes are needed, so opening Holding and spotting the retention multiplier can still bypass reproduction discovery. The functional name helps target that module, and the final hint explicitly reveals the reproduction condition. This is intentional as optional assistance, but may be too direct. The partial report is synthetic evidence; its missing operation times are explicitly marked, while all new player experiments retain their complete history. The scenario's two-step capture/release lifecycle might be discovered by basic control toggling without a strong Aha. More nodes would not resolve that design risk.

**Not measured:** No independent first-time participant test has established surprise, inference quality, engagement, or whether replay removes enough repetitive work. Ask fresh participants which observations suggested their hypothesis, have them predict a contrasting run, and record whether they test before editing nodes. Compare A/B with independent groups or fresh equivalent problems to avoid learning contamination. Measure time spent repeating versus reasoning separately from successful repair. Do not report automated determinism/acceptance checks as evidence of an Aha experience.
