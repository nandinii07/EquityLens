"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe drop-in replacement for motion/react's own `useReducedMotion()`.
 *
 * Root cause this fixes: motion/react's hook (motion-dom's
 * `initPrefersReducedMotion`) reads `window.matchMedia(...)`
 * synchronously during the component's first render, not deferred to an
 * effect. On the server it can only return `null`; on the client's very
 * first render it already returns the real `true`/`false`. When the
 * OS/browser actually has "reduce motion" enabled, that first client
 * render (`true`) disagrees with what was server-rendered (as if
 * `false`), which is a genuine React hydration mismatch — confirmed
 * directly against this app's SSR output. When reduced motion is *off*,
 * `null` and `false` are both falsy everywhere this app branches on the
 * value, so the bug is invisible until you actually test with reduced
 * motion enabled.
 *
 * `useSyncExternalStore`'s third argument, `getServerSnapshot`, exists
 * specifically for reading browser-only state without this class of
 * mismatch: React uses it for the server render AND for the client's
 * hydration-matching first render (so hydration always succeeds), then
 * synchronously swaps in the real client value (`getSnapshot`) before
 * the browser paints — the documented, canonical way to read a
 * client-only media query from React. No visible flash, no layout
 * shift, no hydration warning.
 *
 * Same export name, same boolean return, same call-site usage
 * (`const reduce = useReducedMotion();`) as the hook this replaces —
 * every consumer's animation logic is unchanged, only where the boolean
 * comes from.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** What the server always renders — it has no way to know the client's OS-level preference, so this must match motion/react's own SSR behavior of assuming motion is not reduced. */
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
