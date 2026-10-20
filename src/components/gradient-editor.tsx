"use client";

import { useEffect, useRef } from "react";
import { GRADIENTS, gradientBackground, type Gradient } from "@/lib/backgrounds";
import { CloseIcon } from "./icons";

type GradientEditorProps = {
  gradient: Gradient;
  onChange: (gradient: Gradient) => void;
  onClose: () => void;
};

export function GradientEditor({ gradient, onChange, onClose }: GradientEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function updateColor(index: number, value: string) {
    const colors: [string, string, string] = [...gradient.colors];
    colors[index] = value;
    onChange({ ...gradient, name: "Custom", colors });
  }

  function closeEditor() {
    dialog.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      className="gradient-editor"
      aria-labelledby="gradient-title"
      aria-describedby="gradient-description"
      onCancel={(event) => {
        event.preventDefault();
        closeEditor();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
          closeEditor();
        }
      }}
    >
      <div className="editor-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h2 id="gradient-title">A different atmosphere.</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close gradient editor" onClick={closeEditor} autoFocus>
          <CloseIcon />
        </button>
      </div>
      <p id="gradient-description" className="editor-description">Choose a mood, or mix your own.</p>
      <div className="gradient-presets" aria-label="Gradient presets">
        {GRADIENTS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="gradient-preset"
            aria-pressed={gradient.name === preset.name}
            onClick={() => onChange(preset)}
          >
            <span className="preset-swatch" style={{ backgroundImage: gradientBackground(preset) }}>
              {gradient.name === preset.name && <span className="preset-check">✓</span>}
            </span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
      <div className="editor-divider" />
      <div className="field-heading">
        <span>Your palette</span>
        <span className="field-value">{gradient.name}</span>
      </div>
      <div className="color-fields">
        {gradient.colors.map((color, index) => (
          <label className="color-field" key={index}>
            <input
              type="color"
              aria-label={`Gradient color ${index + 1}`}
              value={color}
              onChange={(event) => updateColor(index, event.target.value)}
            />
            <span>{color.toUpperCase()}</span>
          </label>
        ))}
      </div>
      <label className="angle-field">
        <span className="field-heading">
          <span>Direction</span>
          <output className="field-value">{gradient.angle}°</output>
        </span>
        <input
          type="range"
          min="0"
          max="360"
          step="1"
          value={gradient.angle}
          onChange={(event) => onChange({ ...gradient, angle: Number(event.target.value), name: "Custom" })}
        />
      </label>
      <button className="done-button" type="button" onClick={closeEditor}>Done</button>
      <p className="editor-footnote">A little color changes everything.</p>
    </dialog>
  );
}
