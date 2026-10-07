"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./custom-select.module.css";

export type CustomSelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type CustomSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
};

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите…",
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${open ? ` ${styles.rootOpen}` : ""}`}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.triggerValue}>
          {selected?.icon ? (
            <span className={styles.triggerIcon}>{selected.icon}</span>
          ) : null}
          <span className={selected ? styles.valueText : styles.placeholder}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div id={listId} className={styles.menu} role="listbox">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.option}${active ? ` ${styles.optionActive}` : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className={styles.check} aria-hidden>
                  {active ? "✓" : ""}
                </span>
                {option.icon ? (
                  <span className={styles.optionIcon}>{option.icon}</span>
                ) : null}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
