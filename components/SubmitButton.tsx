"use client";

import { useEffect, useRef, useState } from "react";

// A submit button that makes missing required fields VISIBLE: it disables
// itself and shows exactly what still needs filling, instead of the browser
// silently swallowing the click (the contract "Save does nothing" bug).
export default function SubmitButton({
  children,
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [valid, setValid] = useState(true);
  const [hint, setHint] = useState("");

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const update = () => {
      const ok = form.checkValidity();
      setValid(ok);
      if (ok) {
        setHint("");
        return;
      }
      const firstInvalid = form.querySelector<HTMLInputElement>(
        "input:invalid, select:invalid, textarea:invalid",
      );
      const fieldName =
        firstInvalid?.getAttribute("data-label") ||
        firstInvalid?.name?.replace(/_/g, " ") ||
        "the required fields";
      setHint(
        firstInvalid?.validity.valueMissing
          ? `Fill in ${fieldName} to continue`
          : firstInvalid?.validationMessage || "Check the highlighted fields",
      );
    };
    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, []);

  return (
    <div className="flex flex-col items-start gap-1">
      <button ref={ref} type="submit" disabled={!valid} className={className}>
        {children}
      </button>
      {!valid && hint && <span className="text-xs text-bad">{hint}</span>}
    </div>
  );
}
