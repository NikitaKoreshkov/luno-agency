import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

const AXIS_LOCK = 10;
const SNAP_PX = 48;
const SNAP_RATIO = 0.18;

type Swipe = {
  pointerId: number;
  x: number;
  y: number;
  axis: "h" | "v" | null;
};

export function useCarouselDrag(onCommit: (delta: number) => void) {
  const swipeRef = useRef<Swipe | null>(null);
  const dragXRef = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finish = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = swipeRef.current;
      swipeRef.current = null;
      const dx = dragXRef.current;
      dragXRef.current = 0;
      setDragX(0);
      setDragging(false);

      if (!start || start.pointerId !== event.pointerId || start.axis !== "h") {
        return false;
      }

      const width = event.currentTarget.clientWidth || 1;
      const threshold = Math.max(SNAP_PX, width * SNAP_RATIO);
      if (Math.abs(dx) >= threshold) {
        onCommit(dx < 0 ? 1 : -1);
      }
      return true;
    },
    [onCommit],
  );

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: null,
    };
    dragXRef.current = 0;
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (!start.axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      start.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (start.axis === "h") {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }
    }

    if (start.axis !== "h") return;
    event.preventDefault();
    dragXRef.current = dx;
    setDragX(dx);
  }, []);

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => finish(event),
    [finish],
  );

  const onPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    swipeRef.current = null;
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const block = (event: TouchEvent) => event.preventDefault();
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, [dragging]);

  return {
    dragX,
    dragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
