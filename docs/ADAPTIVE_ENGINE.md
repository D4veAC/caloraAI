# Adaptive Catering Engine

Engine version: `adaptive-v2`. Numerical decisions are deterministic; no LLM can set targets, override allergies, or write a plan.

## Base energy target

- Rule: use the existing Mifflin-St Jeor estimate, activity multiplier, configured goal, and product calorie floor.
- Input: age, equation sex input, height, weight, activity, goal and requested rate.
- Output: base daily energy and macro targets.
- Rationale: evidence-informed estimation plus product safety constraints; it is not a clinical prescription.
- Safety bound: goal adjustment is bounded and daily targets have a product floor.
- Failure mode: inaccurate profile/activity assumptions produce an inaccurate estimate; the UI must not imply laboratory precision.

## Rolling state

- Rule: calculate 7-day state; the service accepts 1–28 days without changing its algorithm.
- Input: food, profile, weights, and provider-normalized activity.
- Output: averages, deviation, completeness, confidence, weight trend and permitted activity average.
- Rationale: human intake varies daily; multi-day state is less noisy than next-day calorie debt.
- Safety bound: missing days lower confidence rather than counting as zero intake.
- Failure mode: selectively logged meals can still bias averages.

## Logging completeness

- Rule: each day contributes up to 1.0 completeness based on three expected meal events.
- Input: count of logged meals per day.
- Output: LOW below 40%, MEDIUM from 40–74%, HIGH at 75%+.
- Rationale: product heuristic used to prevent strong output from sparse logs.
- Safety bound: LOW confidence freezes the base energy target.
- Failure mode: three incomplete entries can appear complete; future versions may use meal-level completeness signals.

## Energy adjustment

- Rule: never repay one day's surplus. Energy changes require HIGH completeness, persistent ≥10% intake deviation, at least two weights, and an off-target trajectory.
- Input: rolling intake deviation, confidence, goal, weight trend.
- Output: at most +100 or -100 kcal/day.
- Rationale: conservative product heuristic, not a validated clinical correction formula.
- Safety bound: fixed 100 kcal step; on-target weight trajectory blocks correction.
- Failure mode: short/noisy weight series can misclassify trajectory; professional review is appropriate when inputs are implausible.

## Protein-first adaptation

- Rule: with MEDIUM/HIGH confidence, a protein deficit over 10% or 15 g prioritizes higher-protein menus before changing energy.
- Input: rolling protein average and target.
- Output: `PROTEIN_UP` and menu-ranking preference.
- Rationale: product heuristic implementing composition-before-energy behavior.
- Safety bound: menu nutrients are stored records and allergy/diet hard constraints run first.
- Failure mode: menu database values and portions may differ from prepared food.

## Activity

- Rule: estimated energy is displayed and averaged; it is never added 1:1 to the food allowance.
- Input: normalized activity records and provider capability policy.
- Output: contextual activity average only.
- Rationale: wearable/user estimates contain material uncertainty.
- Safety bound: provider policy defaults to false unless explicitly permitted; Strava is false.
- Failure mode: manual estimates may be inaccurate.

## Cutoff and reproducibility

- Rule: a plan generated at/after `CALORA_CATERING_CUTOFF_HOUR` is LOCKED; locked plans are not recomputed.
- Input: local server time, cutoff, existing plan.
- Output: immutable tomorrow plan until an admin explicitly changes operational status.
- Rationale: operational constraint—prepared food cannot silently change.
- Safety bound: every saved plan includes engine version, state snapshot, confidence, codes and selected menus.
- Failure mode: server timezone must match the catering operation.
