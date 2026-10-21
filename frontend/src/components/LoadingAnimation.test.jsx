import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LoadingAnimation from "./LoadingAnimation";

describe("LoadingAnimation", () => {
  let container;
  let root;

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

  test("hides the baked-in summoning number while preserving the animation and label", () => {
    act(() => root.render(<LoadingAnimation type="summoning" label="SUMMONING..." imageClassName="w-80 h-80" />));

    expect(container.querySelector("img").getAttribute("src")).toBe("/loading/summoning.gif");
    expect(container.querySelector('[data-testid="summoning-number-mask"]')).not.toBeNull();
    expect(container.textContent).toContain("SUMMONING...");
  });

  test("does not apply the summoning-number mask to other shared loading animations", () => {
    act(() => root.render(<LoadingAnimation type="entering" label="ENTERING THE KEEP..." />));

    expect(container.querySelector("img").getAttribute("src")).toBe("/loading/entering-the-keep.gif");
    expect(container.querySelector('[data-testid="summoning-number-mask"]')).toBeNull();
    expect(container.textContent).toContain("ENTERING THE KEEP...");
  });
});
