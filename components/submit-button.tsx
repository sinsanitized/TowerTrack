"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "@/lib/button-variants";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={buttonClass(variant, className)}
      type="submit"
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending && <LoaderCircle className="animate-spin" size={17} />}
      {pending ? pendingLabel : children}
    </button>
  );
}
