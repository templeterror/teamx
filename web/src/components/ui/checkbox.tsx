"use client";

/*
 * A real checkbox, restyled: the input itself is the box (appearance: none), so it
 * keeps focus, form and screen reader behaviour. The whole label is the target.
 */

import type { ComponentProps, ReactNode } from "react";
import "./checkbox.css";

export type CheckboxProps = Omit<ComponentProps<"input">, "type" | "checked" | "onChange" | "children"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
};

export function Checkbox({ checked, onChange, children, className, ...props }: CheckboxProps) {
  return (
    <label className={className ? `ui-checkbox ${className}` : "ui-checkbox"}>
      <span className="ui-checkbox-control">
        <input
          {...props}
          type="checkbox"
          className="ui-checkbox-input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <svg
          className="ui-checkbox-check"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      {children}
    </label>
  );
}
