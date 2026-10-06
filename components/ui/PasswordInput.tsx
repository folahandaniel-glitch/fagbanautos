"use client";

import { useState, type InputHTMLAttributes } from "react";

/** Password field with a Show / Hide toggle. Drop-in replacement for <input type="password">; works inside server-action forms. */
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`input pr-20 ${className.replace(/\binput\b/g, "").trim()}`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-xs font-semibold text-brand hover:bg-brand-50 focus-visible:outline-2"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
