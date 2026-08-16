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
import { DashboardView } from "@/components/DashboardView";
import { LogForm } from "@/components/LogForm";
import { HistoryList } from "@/components/HistoryList";
import { lastNDays, todayISO } from "@/lib/date";

// Order matches BottomNav — swiping right goes to the previous tab, left to
// the next one. Only these three top-level routes are swipeable; subpages
// like /history/[date] or /sync opt out by not being in this list.
const ROUTES = ["/dashboard", "/", "/history"];
const HISTORY_DAYS_SHOWN = 30;

const SWIPE_THRESHOLD = 60; // px of horizontal drag to trigger a tab change

// Shared padding so the scrollable content clears the fixed TopBar/BottomNav
// — see CLAUDE.md on why this uses dvh/env(safe-area-inset-*) instead of a
// fixed px value. Each pane scrolls independently (rather than the page
// scrolling) so all three can stay mounted side by side for the swipe strip
// below — see the comment on `displayIndex`.
const PANE_SCROLL_CLASS =
  "overflow-y-auto overscroll-y-contain pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]";

function Pane({ widthPercent, children }: { widthPercent: number; children: ReactNode }) {
  return (
    <div className={`h-full flex-shrink-0 ${PANE_SCROLL_CLASS}`} style={{ width: `${widthPercent}%` }}>
      {children}
    </div>
  );
}

export function SwipeNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const routeIndex = ROUTES.indexOf(pathname);
  const swipeable = routeIndex !== -1;

  // Decoupled from routeIndex on purpose: routeIndex only updates once
  // Next.js finishes the navigation, which lags behind a finger release by
  // however long that takes. Driving the visual position from this instead
  // means the slide is one continuous motion — drag, then glide straight to
  // the resting spot — instead of snapping back to the old tab first and
  // jumping to the new one once the route catches up.
  const [displayIndex, setDisplayIndex] = useState(swipeable ? routeIndex : 0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Adjusted during render (React's documented pattern for "derive state
  // from a prop change") rather than in an effect, so an external nav (a
  // BottomNav tap, browser back/forward) updates displayIndex in the same
  // render pass instead of one render behind.
  const [syncedRouteIndex, setSyncedRouteIndex] = useState(routeIndex);
  if (routeIndex !== -1 && routeIndex !== syncedRouteIndex) {
    setSyncedRouteIndex(routeIndex);
    setDisplayIndex(routeIndex);
  }

  // Warms the other tabs so a tap on BottomNav (or the browser back/forward
  // buttons) resolves fast — the swipe animation itself no longer depends on
  // this, since all three panes are already mounted below.
  useEffect(() => {
    for (const route of ROUTES) {
      if (route !== pathname) router.prefetch(route);
    }
  }, [pathname, router]);

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
  const viewportRef = useRef<HTMLDivElement | null>(null);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    start.current = { x: e.clientX, y: e.clientY };
    decided.current = null;
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (!decided.current) {
      if (Math.hypot(dx, dy) < 10) return;
      decided.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (decided.current === "horizontal") setDragging(true);
    }

    if (decided.current !== "horizontal") return;

    const atStart = displayIndex === 0 && dx > 0;
    const atEnd = displayIndex === ROUTES.length - 1 && dx < 0;
    const width = viewportRef.current?.offsetWidth || window.innerWidth;
    const next = atStart || atEnd ? 0 : Math.max(-width, Math.min(width, dx));
    dragXRef.current = next;
    setDragX(next);
  }

  function endDrag() {
    if (decided.current === "horizontal") {
      suppressClick.current = true;
      const finalDragX = dragXRef.current;
      const goNext = finalDragX <= -SWIPE_THRESHOLD && displayIndex < ROUTES.length - 1;
      const goPrev = finalDragX >= SWIPE_THRESHOLD && displayIndex > 0;

      if (goNext || goPrev) {
        const newIndex = displayIndex + (goNext ? 1 : -1);
        setDisplayIndex(newIndex);
        router.push(ROUTES[newIndex]);
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

  if (!swipeable) {
    return <div className={`flex-1 min-h-0 ${PANE_SCROLL_CLASS}`}>{children}</div>;
  }

  return (
    <div ref={viewportRef} className="min-h-0 w-full flex-1 overflow-hidden touch-pan-y">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={preventNativeDrag}
        onClickCapture={handleClickCapture}
        className="flex h-full"
        style={{
          width: `${ROUTES.length * 100}%`,
          transform: `translateX(calc(${(-displayIndex * 100) / ROUTES.length}% + ${dragX}px))`,
          transition: dragging ? "none" : "transform 0.25s ease-out",
        }}
      >
        <Pane widthPercent={100 / ROUTES.length}>
          <DashboardView />
        </Pane>
        <Pane widthPercent={100 / ROUTES.length}>
          <LogForm date={todayISO()} isToday />
        </Pane>
        <Pane widthPercent={100 / ROUTES.length}>
          <HistoryList days={lastNDays(HISTORY_DAYS_SHOWN)} />
        </Pane>
      </div>
    </div>
  );
}
