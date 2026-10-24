import React from "react";

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <div role="alert" className="h-full w-full flex flex-col items-center justify-center bg-[#0a0b10] p-6 text-center">
      <h1 className="font-display font-black text-2xl text-rose-400 mb-3">SCREEN COULD NOT LOAD</h1>
      <p className="font-mono-g text-xs text-slate-300 max-w-sm mb-4">Your saved profile has not been changed. The current screen could not be rendered. Reload the game and try again. If this keeps happening, share the screen name with support.</p>
      <button type="button" className="neon-btn glass-card rounded-lg px-5 py-3 font-mono-g text-xs text-cyan-300" onClick={() => window.location.reload()} data-testid="screen-error-reload">RELOAD GAME</button>
    </div>;
  }
}
