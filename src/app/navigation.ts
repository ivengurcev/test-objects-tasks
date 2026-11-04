import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { routeDepth } from "./routes";

const listeners = new Set<() => void>();
let currentPath = window.location.pathname;
let currentIndex = window.history.state?.crmIndex ?? 0;
window.history.replaceState({ ...window.history.state, crmIndex: currentIndex }, "");
let activeTransition: ViewTransition | undefined;

function updateLocation(path: string, direction: "forward" | "back", updateHistory?: () => void) {
  activeTransition?.skipTransition();
  document.documentElement.dataset.navigation = direction;
  const update = () => {
    updateHistory?.();
    currentPath = path;
    flushSync(() => listeners.forEach((listener) => listener()));
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>("[data-page-content]")?.focus({ preventScroll: true });
  };
  if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    activeTransition = document.startViewTransition(update);
    void activeTransition.finished.catch(() => {});
  } else update();
}

window.addEventListener("popstate", () => {
  const path = window.location.pathname;
  const nextIndex = window.history.state?.crmIndex;
  const backwards = typeof nextIndex === "number"
    ? nextIndex < currentIndex : routeDepth(path) < routeDepth(currentPath);
  currentIndex = nextIndex ?? 0;
  updateLocation(path, backwards ? "back" : "forward");
});

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (path === currentPath) return;
  const direction = routeDepth(path) < routeDepth(currentPath) ? "back" : "forward";
  updateLocation(path, direction, () => {
    if (!options.replace) currentIndex += 1;
    window.history[options.replace ? "replaceState" : "pushState"]({ crmIndex: currentIndex }, "", path);
  });
}

export function usePathname() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => currentPath);
}
