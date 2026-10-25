import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PrepField from "./PrepField";
import { buildTower } from "../game/logic";
import { createHeroModel } from "../game/heroModel";

jest.mock("./ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  StatBar: () => null,
}));

describe("PrepField tower placement confirmation", () => {
  let container;
  let root;
  const state = {
    gold: 1000,
    stone: 500,
    metal: 100,
    heroes: Array.from({ length: 4 }, (_, index) => ({ id: `hero-${index}`, level: 5, cls: "knight" })),
    towers: [],
    barricades: Array.from({ length: 5 }, () => ({ hp: 0, maxHp: 0 })),
    buildings: {},
  };

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("shows the exact slot and cost before confirming the build", async () => {
    const build = jest.fn(() => true);
    act(() => root.render(<PrepField state={state} handlers={{ build }} />));
    act(() => container.querySelector('[data-testid="palette-archer"]').click());
    act(() => container.querySelector('[data-testid="tower-slot-0"]').dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));

    expect(container.querySelector('[data-testid="tower-placement-confirmation-summary"]')?.textContent)
      .toContain("Archer TowerSLOT 1100G · 20S");
    const confirm = container.querySelector('[data-testid="confirm-tower-placement"]');
    expect(confirm.textContent).toContain("CONFIRM SLOT 1");
    expect(confirm.className).toContain("!min-h-12");

    await act(async () => {
      confirm.click();
      await Promise.resolve();
    });
    expect(build).toHaveBeenCalledWith("archer", 60, 182, 0);
    expect(container.querySelector('[data-testid="confirm-tower-placement"]').textContent).toContain("PLACING…");

    const committedState = JSON.parse(JSON.stringify(state));
    expect(buildTower(committedState, "archer", 60, 182, 0)).toBe(true);
    act(() => root.render(<PrepField state={committedState} handlers={{ build }} />));
    expect(container.querySelector('[data-testid="tower-placement-confirmation"]')).toBeNull();
    expect(container.querySelector('[data-testid="field-tower-0"]')).not.toBeNull();
  });

  test("restores confirmation when the queued tower build fails", async () => {
    const build = jest.fn(() => Promise.resolve(false));
    act(() => root.render(<PrepField state={state} handlers={{ build }} />));
    act(() => container.querySelector('[data-testid="palette-archer"]').click());
    act(() => container.querySelector('[data-testid="tower-slot-0"]').dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));

    await act(async () => {
      container.querySelector('[data-testid="confirm-tower-placement"]').click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="confirm-tower-placement"]').textContent).toContain("CONFIRM SLOT 1");
    expect(container.querySelector('[data-testid="confirm-tower-placement"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="tower-placement-preview"]')).not.toBeNull();
  });

  test("renders classless and legacy heroes on the preparation field", () => {
    const classless = createHeroModel({ id: "classless-prep-hero", identityColor: "#F02DCA" });
    const mixedState = { ...state, heroes: [classless, { id: "legacy-prep-hero", cls: "knight", hp: 100, level: 1 }] };

    act(() => root.render(<PrepField state={mixedState} handlers={{}} />));

    const classlessMarker = container.querySelector('[data-testid="prep-hero-classless-prep-hero"]');
    const legacyMarker = container.querySelector('[data-testid="prep-hero-legacy-prep-hero"]');
    expect(classlessMarker).not.toBeNull();
    expect(classlessMarker.style.background).toBe("rgb(240, 45, 202)");
    expect(legacyMarker).not.toBeNull();
    expect(legacyMarker.style.background).toBeTruthy();
  });
});
