"use client";

import {
  forwardRef,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type TextareaHTMLAttributes,
} from "react";
import { useGlassInteraction } from "./useGlassInteraction";
import { useLiquidInputPhysics } from "./useLiquidInputPhysics";
import styles from "./GlassControls.module.css";

export type GlassAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> & {
  className?: string;
  inputClassName?: string;
  liquid?: boolean;
  liquidIntensity?: number;
  resize?: "none" | "vertical";
};

export const GlassArea = forwardRef<HTMLTextAreaElement, GlassAreaProps>(
  function GlassArea(
    {
      className,
      inputClassName,
      value,
      rows = 4,
      liquid = true,
      liquidIntensity = 1,
      resize = "vertical",
      ...rest
    },
    forwardedRef,
  ) {
    const { nodeRef, state, handlers } = useGlassInteraction();
    const physics = useLiquidInputPhysics(
      nodeRef,
      liquid ? liquidIntensity : 0,
    );
    const areaRef = useRef<HTMLTextAreaElement | null>(null);

    function assignArea(node: HTMLTextAreaElement | null) {
      areaRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }

    function focusFromBlock(event: ReactMouseEvent<HTMLDivElement>) {
      if (event.button !== 0) return;
      const area = areaRef.current;
      if (!area || area.disabled || rest.readOnly) return;
      const target = event.target as Node | null;
      if (target && (target === area || area.contains(target))) return;
      event.preventDefault();
      area.focus({ preventScroll: true });
      const len = area.value.length;
      try {
        area.setSelectionRange(len, len);
      } catch {
        /* some input types reject selection */
      }
    }

    return (
      <div
        ref={(node) => {
          nodeRef.current = node;
        }}
        onPointerEnter={handlers.onPointerEnter}
        onPointerLeave={handlers.onPointerLeave}
        onMouseDown={focusFromBlock}
        data-focus={state.focus}
        data-hover={state.hover}
        data-press={false}
        data-liquid={liquid ? "true" : undefined}
        data-area="true"
        data-resize={resize}
        className={[styles.control, styles.field, styles.area, className]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.fill} aria-hidden="true" />
        <span className={styles.bevel} aria-hidden="true" />
        <span className={styles.rim} aria-hidden="true" />
        <textarea
          {...rest}
          ref={assignArea}
          rows={rows}
          value={value}
          onFocus={(event) => {
            handlers.onFocus();
            physics.focus();
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            handlers.onBlur();
            physics.blur();
            rest.onBlur?.(event);
          }}
          onInput={(event) => {
            physics.pulse(event.currentTarget.value.length);
            rest.onInput?.(event);
          }}
          className={[
            styles.fieldInput,
            styles.areaInput,
            resize === "none" ? styles.areaInputNoResize : null,
            inputClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>
    );
  },
);
