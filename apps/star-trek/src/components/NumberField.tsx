"use client";

import { useId, useState } from "react";

function normalize(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Number(value.toPrecision(10)));
}

/**
 * Campo numérico que respeta lo que el usuario está escribiendo: acepta
 * estados intermedios como "-", "0." o "" mientras el foco está dentro y solo
 * ajusta el valor a los límites al salir.
 */
export default function NumberField({
  value,
  onCommit,
  min,
  max,
  step,
  suffix,
  label,
  hint,
  disabled,
}: {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(() => normalize(value));
  const [focused, setFocused] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);

  // Si el valor cambia desde fuera (un preset, un chip) mientras el campo no
  // tiene el foco, el texto se pone al día durante el render.
  if (!focused && value !== syncedValue) {
    setSyncedValue(value);
    setText(normalize(value));
  }

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) return;
    if (parsed < min || parsed > max) return;
    onCommit(parsed);
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      setText(normalize(value));
      setSyncedValue(value);
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    onCommit(clamped);
    setText(normalize(clamped));
    setSyncedValue(clamped);
  };

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          step={step}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
        />
        {suffix ? <span className="field-suffix">{suffix}</span> : null}
      </div>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
