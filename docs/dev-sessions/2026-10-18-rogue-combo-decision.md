# Rogue Combo Decision — Implementation Deferred

## Confirmed facts

- `frontend/src/game/perks.js` declares Rogue Combo (`rouge_combo`) with a
  +15% `abilityDamagePct` effect and the description “Successive strikes gain
  +15% ability damage.”
- `frontend/src/game/logic.js:heroDerived` includes `abilityDamagePct` in the
  shared `abilityDamageMultiplier`.
- `frontend/src/game/engine.js:_applyAbilityDamage` consumes that multiplier
  for damaging active abilities. As a result, Rogue Combo can affect unrelated
  damaging active abilities through the shared multiplier.
- The engine does not track a Rogue Combo sequence and does not define sequence
  reset conditions.
- Backstab and Life Steal are candidate qualifying actions. Their eligibility
  for Rogue Combo and any sequence rules have not been approved.

## Decision status

Implementation is **deferred** until the user approves the exact sequence
rules. This report does not select qualifying actions or define sequence,
reset, timing, stacking, or target-switching behavior.
