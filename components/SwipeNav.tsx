"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";

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

  const index = ROUTES.indexOf(pathname);
  const swipeable = index !== -1;

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
      if (finalDragX <= -SWIPE_THRESHOLD && index < ROUTES.length - 1) {
        router.push(ROUTES[index + 1]);
      } else if (finalDragX >= SWIPE_THRESHOLD && index > 0) {
        router.push(ROUTES[index - 1]);
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
