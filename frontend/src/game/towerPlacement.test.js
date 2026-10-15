import {
  assignTowerPlacementSlots,
  commitTowerPlacement,
  logicalTowerPosition,
  nearestAvailablePlacement,
  placementForSlot,
} from "./towerPlacement";

const slots = [
  { x: 60, y: 182 },
  { x: 360, y: 182 },
  { x: 60, y: 342 },
];

describe("tower placement", () => {
  test("preparation and battle use the tower's saved logical coordinates", () => {
    const tower = { x: 123, y: 234, placementSlot: 1 };
    expect(logicalTowerPosition(tower)).toEqual({ x: 123, y: 234 });
  });

  test("confirm carries the selected slot through the build callback", () => {
    const placement = placementForSlot("archer", 2, slots);
    const build = jest.fn(() => true);

    expect(commitTowerPlacement(placement, build)).toBe(true);
    expect(build).toHaveBeenCalledWith("archer", 60, 342, 2);
  });

  test("explicit slot assignments remain stable when another tower is added", () => {
    const before = [{ id: "first", x: 60, y: 182, placementSlot: 0 }];
    const after = [...before, { id: "second", x: 360, y: 182, placementSlot: 1 }];

    expect(assignTowerPlacementSlots(before, slots)).toEqual([0]);
    expect(assignTowerPlacementSlots(after, slots)).toEqual([0, 1]);
  });

  test("legacy towers get unique occupancy slots without changing their position", () => {
    const legacy = [{ x: 61, y: 183 }, { x: 359, y: 184 }];
    const originalPositions = legacy.map(logicalTowerPosition);

    expect(assignTowerPlacementSlots(legacy, slots)).toEqual([0, 1]);
    expect(legacy.map(logicalTowerPosition)).toEqual(originalPositions);
  });

  test("nearest placement excludes occupied slots", () => {
    expect(nearestAvailablePlacement({ x: 61, y: 183 }, slots, [0])).toMatchObject({
      x: 60,
      y: 342,
      slotIndex: 2,
    });
  });
});
