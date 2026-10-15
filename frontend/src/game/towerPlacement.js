// Logical placement data shared by the preparation view and battle setup.
// Saved tower x/y remain authoritative; placementSlot records the selected
// circle for stable occupancy and backward-compatible legacy assignment.
export function assignTowerPlacementSlots(towers, slots) {
  const assignments = Array(towers.length).fill(null);
  const occupied = new Set();

  towers.forEach((tower, towerIndex) => {
    const index = tower?.placementSlot;
    if (Number.isInteger(index) && index >= 0 && index < slots.length && !occupied.has(index)) {
      assignments[towerIndex] = index;
      occupied.add(index);
    }
  });

  const pairs = towers.flatMap((tower, towerIndex) => {
    if (!tower || assignments[towerIndex] !== null) return [];
    return slots.flatMap((slot, slotIndex) => occupied.has(slotIndex) ? [] : [{
      towerIndex,
      slotIndex,
      distance: Math.hypot((Number(tower.x) || 0) - slot.x, (Number(tower.y) || 0) - slot.y),
    }]);
  }).sort((a, b) => a.distance - b.distance || a.towerIndex - b.towerIndex || a.slotIndex - b.slotIndex);

  const assignedTowers = new Set(assignments.flatMap((slot, index) => slot === null ? [] : [index]));
  for (const pair of pairs) {
    if (assignedTowers.has(pair.towerIndex) || occupied.has(pair.slotIndex)) continue;
    assignments[pair.towerIndex] = pair.slotIndex;
    assignedTowers.add(pair.towerIndex);
    occupied.add(pair.slotIndex);
  }
  return assignments;
}

export function placementForSlot(type, slotIndex, slots) {
  const slot = slots[slotIndex];
  return slot ? { type, slotIndex, x: slot.x, y: slot.y } : null;
}

export function logicalTowerPosition(tower) {
  return { x: tower.x, y: tower.y };
}

export function nearestAvailablePlacement(point, slots, assignments) {
  let best = null;
  slots.forEach((slot, slotIndex) => {
    if (assignments.includes(slotIndex)) return;
    const distance = (slot.x - point.x) ** 2 + (slot.y - point.y) ** 2;
    if (!best || distance < best.distance) best = { ...slot, slotIndex, distance };
  });
  return best;
}

export function commitTowerPlacement(placement, build) {
  if (!placement) return false;
  return build(placement.type, placement.x, placement.y, placement.slotIndex);
}

export function logicalPositionPercent(position, width, height) {
  return { left: `${(position.x / width) * 100}%`, top: `${(position.y / height) * 100}%` };
}
