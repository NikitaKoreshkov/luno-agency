"use client";

import {
  ClipboardEvent,
  KeyboardEvent,
  useRef,
} from "react";
import styles from "./auth-forms.module.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  idPrefix?: string;
};

const LENGTH = 6;

function toCells(value: string) {
  return Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "").slice(0, LENGTH);
}

export function VerificationCodeInput({
  value,
  onChange,
  disabled = false,
  idPrefix = "code",
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = toCells(value);

  const commit = (cells: string[], focusIndex?: number) => {
    const joined = cells.join("").slice(0, LENGTH);
    onChange(joined);
    if (focusIndex !== undefined) {
      requestAnimationFrame(() => refs.current[focusIndex]?.focus());
    }
  };

  const fillFrom = (raw: string, start = 0) => {
    const digits = digitsOnly(raw);
    if (!digits) return;
    const next = toCells(value);
    for (let i = 0; i < digits.length && start + i < LENGTH; i++) {
      next[start + i] = digits[i];
    }
    const focusIndex = Math.min(start + digits.length, LENGTH - 1);
    commit(next, focusIndex);
  };

  const setAt = (index: number, digit: string) => {
    const next = toCells(value);
    next[index] = digit;
    commit(next, digit && index < LENGTH - 1 ? index + 1 : index);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (chars[index]) {
        setAt(index, "");
        return;
      }
      if (index > 0) {
        e.preventDefault();
        const next = toCells(value);
        next[index - 1] = "";
        commit(next, index - 1);
      }
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handleChange = (index: number, raw: string) => {
    const digits = digitsOnly(raw);
    if (!digits) {
      setAt(index, "");
      return;
    }
    if (digits.length > 1) {
      fillFrom(digits, index);
      return;
    }
    setAt(index, digits);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fillFrom(e.clipboardData.getData("text"), 0);
  };

  return (
    <div className={styles.codeRow} role="group" aria-label="Код из письма">
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          id={`${idPrefix}-${index}`}
          className={`${styles.codeCell}${char ? ` ${styles.codeCellFilled}` : ""}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={char}
          disabled={disabled}
          aria-label={`Цифра ${index + 1}`}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onChange={(e) => handleChange(index, e.target.value)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
