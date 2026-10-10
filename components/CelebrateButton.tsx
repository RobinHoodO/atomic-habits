"use client";

import type { ReactNode } from "react";
import { celebrate, originOf, primeAudio } from "@/components/Celebrate";

// Submit button for plain server-action forms: celebrates on tap, then the form submits as usual.
export default function CelebrateButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        primeAudio();
        celebrate(originOf(e.currentTarget));
      }}
    >
      {children}
    </button>
  );
}
