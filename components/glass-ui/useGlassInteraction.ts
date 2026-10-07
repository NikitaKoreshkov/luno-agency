"use client";

import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { usePointerSheen } from "@/lib/glass/usePointerSheen";
import { prefersReducedMotion } from "@/lib/perf/deviceTier";

export type GlassInteractionState = {
  hover: boolean;
  press: boolean;
  focus: boolean;
  armed: boolean;
};

export type GlassInteractionHandlers = {
  onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

function liveArmed(press: boolean, focus: boolean): boolean {
  return press || focus;
}

export function useGlassInteraction(disabled = false) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<GlassInteractionState>({
    hover: false,
    press: false,
    focus: false,
    armed: false,
  });

  const { anchor, release } = usePointerSheen(nodeRef, {
    xVar: "--glass-pointer-x",
    yVar: "--glass-pointer-y",
    reduced: prefersReducedMotion(),
  });

  const handlers: GlassInteractionHandlers = {
    onPointerEnter: (event) => {
      if (disabled) return;
      anchor(event, true);
      setState((prev) => ({
        ...prev,
        hover: true,
        armed: liveArmed(prev.press, prev.focus),
      }));
    },
    onPointerLeave: () => {
      if (disabled) return;
      release();
      setState((prev) => ({
        ...prev,
        hover: false,
        press: false,
        armed: liveArmed(false, prev.focus),
      }));
    },
    onPointerDown: (event) => {
      if (disabled) return;
      anchor(event, true);
      setState((prev) => ({
        ...prev,
        press: true,
        armed: true,
      }));
    },
    onPointerUp: () => {
      if (disabled) return;
      setState((prev) => ({
        ...prev,
        press: false,
        armed: liveArmed(false, prev.focus),
      }));
    },
    onPointerCancel: () => {
      if (disabled) return;
      setState((prev) => ({
        ...prev,
        press: false,
        armed: liveArmed(false, prev.focus),
      }));
    },
    onFocus: () => {
      if (disabled) return;
      setState((prev) => ({
        ...prev,
        focus: true,
        armed: true,
      }));
    },
    onBlur: () => {
      if (disabled) return;
      setState((prev) => ({
        ...prev,
        focus: false,
        press: false,
        armed: liveArmed(prev.press, false),
      }));
    },
  };

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled) return;
      anchor(event);
    },
    [anchor, disabled],
  );

  return { nodeRef, state, handlers, onPointerMove };
}
