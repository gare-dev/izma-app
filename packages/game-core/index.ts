// Re-export everything from the registry (types, interfaces, functions).
export {
    type GameEngine,
    type BroadcastFn,
    type GameEngineFactory,
    registerEngine,
    createEngine,
    getRegisteredEngines,
} from "./registry";

// ─── Built-in Engines ───────────────────────────────────────────────────────
// Each engine lives under engines/<gameId>.ts and auto-registers itself.
// Import them here so they register when the package is loaded.

import "./engines/reaction";
import "./engines/color-match";
