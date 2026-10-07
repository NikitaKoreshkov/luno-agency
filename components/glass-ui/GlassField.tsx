"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { useGlassInteraction } from "./useGlassInteraction";
import { useLiquidInputPhysics } from "./useLiquidInputPhysics";
import styles from "./GlassControls.module.css";

export type GlassFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  icon?: ReactNode;
  onClear?: () => void;
  className?: string;
  inputClassName?: string;
  liquid?: boolean;
  liquidIntensity?: number;
};

const ClearGlyph = (
  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M3 3l6 6M9 3l-6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const GlassField = forwardRef<HTMLInputElement, GlassFieldProps>(
  function GlassField(
    {
      icon,
      onClear,
      className,
      inputClassName,
      value,
      liquid = true,
      liquidIntensity = 1,
      ...rest
    },
    forwardedRef,
  ) {
    const { nodeRef, state, handlers } = useGlassInteraction();
    const physics = useLiquidInputPhysics(
      nodeRef,
      liquid ? liquidIntensity : 0,
    );
    const hasValue = typeof value === "string" ? value.length > 0 : false;

    return (
      <div
        ref={(node) => {
          nodeRef.current = node;
        }}
        onPointerEnter={handlers.onPointerEnter}
        onPointerLeave={handlers.onPointerLeave}
        data-focus={state.focus}
        data-hover={state.hover}
        data-press={false}
        data-liquid={liquid ? "true" : undefined}
        className={[styles.control, styles.field, className]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.fill} aria-hidden="true" />
        <span className={styles.bevel} aria-hidden="true" />
        <span className={styles.rim} aria-hidden="true" />
        {icon ? (
          <span className={styles.fieldIcon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <input
          {...rest}
          ref={forwardedRef}
          value={value}
          onFocus={(event) => {
            handlers.onFocus();
            if (liquid) physics.focus(0.35);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            handlers.onBlur();
            if (liquid) physics.blur();
            rest.onBlur?.(event);
          }}
          onInput={(event) => {
            if (liquid) physics.pulse(event.currentTarget.value.length);
            rest.onInput?.(event);
          }}
          className={[styles.fieldInput, inputClassName]
            .filter(Boolean)
            .join(" ")}
        />
        {onClear && hasValue ? (
          <button
            type="button"
            className={styles.fieldClear}
            onClick={onClear}
            aria-label="Очистить"
          >
            {ClearGlyph}
          </button>
        ) : null}
      </div>
    );
  },
);
