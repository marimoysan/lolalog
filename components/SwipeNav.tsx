"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

// Order matches BottomNav — swiping right goes to the previous tab, left to
// the next one. Only these three top-level routes are swipeable; subpages
// like /history/[date] or /sync opt out by not being in this list.
const ROUTES = ["/dashboard", "/", "/history"];

const SWIPE_THRESHOLD = 60; // px of horizontal drag to trigger a tab change
const DIRECTION_LOCK = 10; // px of movement before we decide horizontal vs vertical
const MAX_DRAG = 120; // px, visual clamp so the drag never feels unbounded

export function SwipeNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const start = useRef<{ x: number; y: number } | null>(null);
  const decided = useRef<"horizontal" | "vertical" | null>(null);
  // Mirrors dragX synchronously — endDrag can fire (e.g. via pointercancel,
  // which browsers dispatch mid-gesture when a child <a> starts a native
  // link drag) before React has committed the last setDragX, so reading
  // state there would see a stale value.
  const dragXRef = useRef(0);
  // A horizontal drag ending on top of a link/button (e.g. a HistoryList
  // row) still fires a click on release — swallow exactly that one click
  // so a swipe never also triggers the thing being swiped over.
  const suppressClick = useRef(false);
  // Set to the exit direction the moment a swipe commits to a route change,
  // so the pathname-change effect below knows to snap the (now-new) page
  // back into view instead of leaving it slid off-screen.
  const committedExit = useRef<1 | -1 | null>(null);

  const index = ROUTES.indexOf(pathname);
  const swipeable = index !== -1;

  // Client-side navigation without a prefetched route has to fetch/compile
  // the target before it can render, which is what made the swipe feel
  // like it "did nothing" for a beat before jumping — warm the other tabs
  // so router.push below can complete near-instantly.
  useEffect(() => {
    for (const route of ROUTES) {
      if (route !== pathname) router.prefetch(route);
    }
  }, [pathname, router]);

  // Once the route has actually changed (new page mounted under us), snap
  // the still-off-screen transform back to 0 without animating — the slide
  // "out" already played on release, so this just reveals the new page in
  // place instead of sliding it in from off-screen too.
  useEffect(() => {
    if (committedExit.current === null) return;
    committedExit.current = null;
    dragXRef.current = 0;
    setDragging(true);
    setDragX(0);
    const frame = requestAnimationFrame(() => setDragging(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!swipeable) return;
    start.current = { x: e.clientX, y: e.clientY };
    decided.current = null;
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (!decided.current) {
      if (Math.hypot(dx, dy) < DIRECTION_LOCK) return;
      decided.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (decided.current === "horizontal") setDragging(true);
    }

    if (decided.current !== "horizontal") return;

    const atStart = index === 0 && dx > 0;
    const atEnd = index === ROUTES.length - 1 && dx < 0;
    const next = atStart || atEnd ? 0 : Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
    dragXRef.current = next;
    setDragX(next);
  }

  function endDrag() {
    if (decided.current === "horizontal") {
      suppressClick.current = true;
      const finalDragX = dragXRef.current;
      const goNext = finalDragX <= -SWIPE_THRESHOLD && index < ROUTES.length - 1;
      const goPrev = finalDragX >= SWIPE_THRESHOLD && index > 0;

      if (goNext || goPrev) {
        // Keep carrying the current screen off in the same direction (a
        // "fling" continuation) instead of snapping back to center first —
        // that snap-back was the visual cue that made the eventual route
        // change look like a delayed, unrelated jump.
        committedExit.current = goNext ? -1 : 1;
        dragXRef.current = 0;
        setDragging(false);
        setDragX((goNext ? -1 : 1) * window.innerWidth);
        router.push(ROUTES[index + (goNext ? 1 : -1)]);
        start.current = null;
        decided.current = null;
        return;
      }
    }
    start.current = null;
    decided.current = null;
    dragXRef.current = 0;
    setDragging(false);
    setDragX(0);
  }

  // Links/images inside the swipeable area (e.g. HistoryList rows) are
  // natively draggable in Chromium/Safari; without this, dragging one
  // starts an HTML5 drag-and-drop gesture that cuts the pointermove
  // sequence short (a pointercancel fires) instead of letting the swipe
  // continue.
  function preventNativeDrag(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDragStart={preventNativeDrag}
      onClickCapture={handleClickCapture}
      className="flex w-full flex-1 flex-col touch-pan-y"
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        transition: dragging ? "none" : "transform 0.2s ease-out",
      }}
    >
      {children}
    </div>
  );
}
