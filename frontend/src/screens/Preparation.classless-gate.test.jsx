import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createHeroModel } from "../game/heroModel";
import { createNewState } from "../game/logic";
import Preparation from "./Preparation";

let mockGameContext;

jest.mock("../context/GameProvider", () => ({ useGame: () => mockGameContext }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  TopResourceHUD: () => null,
  SectionTitle: ({ children }) => <div>{children}</div>,
  StatBar: () => null,
  HeroMiniSprite: () => null,
}));
jest.mock("../components/cards", () => ({ HeroCard: () => null, TowerCard: () => null }));
jest.mock("../components/PrepField", () => () => null);
jest.mock("../components/CastleBuildings", () => () => null);
jest.mock("../components/DebugPanel", () => () => null);
jest.mock("../components/ui/tabs", () => ({
  Tabs: ({ children }) => <div>{children}</div>,
  TabsList: ({ children }) => <div>{children}</div>,
  TabsTrigger: ({ children }) => <button>{children}</button>,
  TabsContent: ({ children }) => <div>{children}</div>,
}));

describe("classless preparation battle entry", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const state = createNewState();
    state.heroes = [createHeroModel({ id: "prep-gated-hero" })];
    mockGameContext = {
      state,
      mutate: jest.fn(),
      setScreen: jest.fn(),
      saveNow: jest.fn(),
      offlineGains: {},
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("saves and enters battle for a classless squad", () => {
    act(() => root.render(<Preparation />));
    act(() => container.querySelector('[data-testid="start-wave-button"]').click());

    expect(container.querySelector('[data-testid="classless-combat-notice"]')).toBeNull();
    expect(mockGameContext.saveNow).toHaveBeenCalledTimes(1);
    expect(mockGameContext.setScreen).toHaveBeenCalledWith("battle");
  });
});
