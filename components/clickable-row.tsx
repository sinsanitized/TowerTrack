"use client";

import { useRouter } from "next/navigation";
import type { ElementType, MouseEvent, ReactNode } from "react";

const interactiveSelector =
  'a, button, input, select, textarea, summary, details, label, [role="button"]';

function cameFromInteractiveControl(target: EventTarget | null) {
  return (
    target instanceof Element && target.closest(interactiveSelector) != null
  );
}

type ClickableRowProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  href?: string | null;
  label?: string;
  testId?: string;
};

export function ClickableRow({
  as: Component = "div",
  children,
  className = "",
  href,
  label,
  testId,
}: ClickableRowProps) {
  const router = useRouter();
  const open = () => {
    if (href) router.push(href);
  };
  return (
    <Component
      className={`${href ? "cursor-pointer transition hover:bg-emerald-50/40" : ""} ${className}`}
      data-action-label={href ? label : undefined}
      data-testid={testId}
      onClick={(event: MouseEvent<HTMLElement>) => {
        if (href && !cameFromInteractiveControl(event.target)) open();
      }}
    >
      {children}
    </Component>
  );
}

export function ClickableTableRow({
  children,
  className = "",
  href,
  label,
  testId,
}: Omit<ClickableRowProps, "as">) {
  return (
    <ClickableRow
      as="tr"
      className={className}
      href={href}
      label={label}
      testId={testId}
    >
      {children}
    </ClickableRow>
  );
}
