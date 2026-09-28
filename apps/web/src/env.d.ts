/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Default data source for this build: "replay" (2022) or "live" (results.json). ?source= overrides it. */
  readonly VITE_SOURCE?: string;
  /** Where the poller's results.json is served; relative to the page unless absolute. */
  readonly VITE_LIVE_URL?: string;
}
