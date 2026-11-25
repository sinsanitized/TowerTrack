"use client";

import Link from "next/link";
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
      className={`${href ? "relative cursor-pointer transition hover:bg-emerald-50/40" : ""} ${className}`}
      data-action-label={href ? label : undefined}
      data-testid={testId}
      role={href && Component === "tr" ? "link" : undefined}
      tabIndex={href && Component === "tr" ? 0 : undefined}
      aria-label={href && Component === "tr" ? label : undefined}
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
      {href && Component !== "tr" && (
        <Link
          href={href}
          aria-label={label}
          className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        />
      )}
      {Component === "tr" ? (
        children
      ) : (
        <div className="pointer-events-none contents [&_a]:relative [&_a]:z-20 [&_a]:pointer-events-auto [&_button]:relative [&_button]:z-20 [&_button]:pointer-events-auto [&_details]:relative [&_details]:z-20 [&_details]:pointer-events-auto [&_input]:relative [&_input]:z-20 [&_input]:pointer-events-auto [&_label]:relative [&_label]:z-20 [&_label]:pointer-events-auto [&_select]:relative [&_select]:z-20 [&_select]:pointer-events-auto [&_textarea]:relative [&_textarea]:z-20 [&_textarea]:pointer-events-auto">
          {children}
        </div>
      )}
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
