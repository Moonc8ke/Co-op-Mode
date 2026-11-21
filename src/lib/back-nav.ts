import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Back navigation for this single-page app.
 *
 * The app is one page: views switch in state (home / Add & browse /
 * scrapbook) and details open as pop-outs on top. There used to be no
 * history to go back through, so the phone's system back gesture left
 * the app from anywhere. This module gives every view and pop-out a
 * place in a back stack wired to browser history:
 *
 * - Opening a layer pushes one history entry for it.
 * - A system back press pops that entry; the popstate handler closes
 *   the topmost layer. On home with nothing open there is no entry of
 *   ours to pop, so the browser leaves the app as usual.
 * - Closing a layer from the UI (a button, the backdrop, Escape)
 *   unwinds the history entry it pushed, so the user never has to
 *   press back twice for one step.
 * - A swipe right starting near the left edge does the same one step
 *   back (see useEdgeSwipeBack). On Android and iOS the OS usually
 *   claims an edge swipe as its own back gesture, which lands here
 *   through history; the in-app swipe covers the cases where it
 *   doesn't (a swipe starting just inside the edge, a slow drag).
 *
 * Deliberately NOT covered: the identity picker, the one-time season
 * greeting, and the backup import result — transient UI, not places.
 * And there is no "exit the app" gesture here on purpose: a web app
 * cannot close itself, so exiting stays the system back gesture's
 * job from home.
 */

/** One open view or pop-out that a back step should close. The stack
 * order is the order layers were opened, so the topmost layer is
 * always the one a back step closes first. */
type BackLayer = { key: string; close: () => void };

const layers: BackLayer[] = [];

/** How many history entries were pushed for back layers. The browser
 * only fires popstate for a real back step; tracking the count keeps a
 * UI close from calling history.back() when there is nothing of ours
 * to unwind (which would navigate away from the app instead). */
let pushedCount = 0;

/** Set when a UI close unwinds history on purpose, so the popstate
 * that follows doesn't close a second layer. */
let suppressNextPopstate = false;

function registerBackLayer(key: string, close: () => void): void {
  unregisterBackLayer(key);
  layers.push({ key, close });
}

function unregisterBackLayer(key: string): void {
  const at = layers.findIndex((l) => l.key === key);
  if (at >= 0) layers.splice(at, 1);
}

function hasBackLayers(): boolean {
  return layers.length > 0;
}

/** Close the topmost layer (the one opened most recently). Returns
 * false when nothing is open. */
function closeTopBackLayer(): boolean {
  const top = layers.pop();
  if (!top) return false;
  top.close();
  return true;
}

/** Open a back layer: remember how to close it, and push a history
 * entry for it, so the phone's system back gesture lands here instead
 * of leaving the app. */
function openBackLayer(key: string, close: () => void): void {
  registerBackLayer(key, close);
  try {
    window.history.pushState({ backLayer: key }, "");
    pushedCount += 1;
  } catch {
    // History unavailable (rare, sandboxed contexts); the layer still
    // closes through the stack, the system gesture just won't see it.
  }
}

/** Close a layer from the UI (a button, the backdrop, Escape): run its
 * close, then unwind the history entry it pushed. The popstate that
 * history.back() fires is suppressed, so nothing closes twice. */
function closeBackLayerViaUi(close: () => void): void {
  close();
  if (pushedCount > 0) {
    pushedCount -= 1;
    suppressNextPopstate = true;
    try {
      window.history.back();
    } catch {
      suppressNextPopstate = false;
    }
  }
}

/** One step back, the way the system back gesture does it: if a layer
 * is open, unwind its history entry and let popstate close it; with
 * nothing open, do nothing — on home the system gesture exits the app
 * by itself. */
export function goBackOnce(): void {
  if (!hasBackLayers()) return;
  if (pushedCount > 0) {
    try {
      window.history.back();
      return;
    } catch {
      // Fall through to closing the layer directly.
    }
  }
  closeTopBackLayer();
}

/** Mount once (in CouplesApp): a system back press closes the topmost
 * back layer. With nothing open there is no entry of ours to pop, so
 * the browser leaves the app as usual. Forward navigation has no
 * gesture on phones, so a popstate is always treated as one step back.
 */
export function useBackNavigation(): void {
  useEffect(() => {
    const onPopState = () => {
      if (suppressNextPopstate) {
        suppressNextPopstate = false;
        return;
      }
      // A real back step consumed one of our pushed entries.
      pushedCount = Math.max(0, pushedCount - 1);
      closeTopBackLayer();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}

/** How far from the left edge a touch must start to count as an edge
 * swipe, and how far right it must travel to count as "go back". */
const EDGE_PX = 24;
const SWIPE_PX = 60;

/**
 * A swipe right starting near the left edge behaves like the system
 * back gesture. Purely observational — passive listeners, no
 * preventDefault — so scrolling and taps are never disturbed. A slow
 * drag or a mostly-vertical swipe is ignored; a missed swipe is better
 * than one that fires while scrolling.
 */
export function useEdgeSwipeBack(): void {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const isOffLimitsTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      // Text entry and pickers: a horizontal swipe inside them moves
      // the cursor or the picker, so leave those touches alone.
      if (
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return true;
      }
      // Horizontally scrolling strips: a swipe there scrolls the strip,
      // not the app.
      let el: Element | null = target;
      while (el) {
        if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 4) {
          const overflowX = window.getComputedStyle(el).overflowX;
          if (overflowX === "auto" || overflowX === "scroll") return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch || e.changedTouches.length !== 1) {
        tracking = false;
        return;
      }
      if (touch.clientX > EDGE_PX || isOffLimitsTarget(e.target)) {
        tracking = false;
        return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // Clearly horizontal, far enough to mean it, and not a scroll.
      if (dx >= SWIPE_PX && dx > Math.abs(dy) * 1.5) {
        goBackOnce();
      }
    };

    const onTouchCancel = () => {
      tracking = false;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);
}

/**
 * Wire one open view or pop-out into the back stack. `isOpen` is the
 * layer's own state; `onClose` is how it closes. Returns helpers the
 * component calls from its own open and close actions:
 * - `open()`: call next to setting the layer open (pushes history).
 * - `closeViaUi()`: call from buttons, the backdrop, Escape (closes
 *   and unwinds the history entry). Safe to call when the layer is
 *   already closed — then it just runs onClose without touching
 *   history, which matters for deletes triggered from a list row
 *   instead of from inside the pop-out.
 */
export function useBackLayer(
  key: string,
  isOpen: boolean,
  onClose: () => void,
): { open: () => void; closeViaUi: () => void } {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    if (!isOpen) return;
    const close = () => onCloseRef.current();
    registerBackLayer(key, close);
    return () => unregisterBackLayer(key);
  }, [isOpen, key]);

  const open = useCallback(() => {
    openBackLayer(key, () => onCloseRef.current());
  }, [key]);

  const closeViaUi = useCallback(() => {
    if (isOpenRef.current) {
      closeBackLayerViaUi(() => onCloseRef.current());
    } else {
      onCloseRef.current();
    }
  }, []);

  return useMemo(() => ({ open, closeViaUi }), [open, closeViaUi]);
}
