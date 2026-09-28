"use client";

import { useRouter } from "next/navigation";
import type { ElementType, KeyboardEvent, MouseEvent, ReactNode } from "react";

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
      role={href ? "link" : undefined}
      tabIndex={href ? 0 : undefined}
      aria-label={href ? label : undefined}
      onClick={(event: MouseEvent<HTMLElement>) => {
        if (href && !cameFromInteractiveControl(event.target)) open();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (
          href &&
          !cameFromInteractiveControl(event.target) &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          open();
        }
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
