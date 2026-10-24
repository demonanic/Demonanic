import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ScreenErrorBoundary from "./ScreenErrorBoundary";

test("shows actionable reload UI after a screen render exception", () => {
  const original = console.error;
  console.error = jest.fn();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  function BrokenScreen() { throw new Error("screen fixture failed"); }
  try {
    act(() => root.render(<ScreenErrorBoundary><BrokenScreen /></ScreenErrorBoundary>));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Your saved profile has not been changed");
    expect(container.textContent).toContain("The current screen could not be rendered");
    expect(container.querySelector('[data-testid="screen-error-reload"]')).not.toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
    console.error = original;
  }
});
