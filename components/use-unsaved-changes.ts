"use client";

import { useCallback, useEffect, useState } from "react";

const DISCARD_MESSAGE =
  "You have unsaved changes. Leave this page and discard them?";

export function useUnsavedChanges() {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const warnBeforeLink = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (window.confirm(DISCARD_MESSAGE)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeLink, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeLink, true);
    };
  }, [dirty]);

  const confirmDiscard = useCallback(() => {
    if (!dirty || window.confirm(DISCARD_MESSAGE)) {
      setDirty(false);
      return true;
    }
    return false;
  }, [dirty]);

  return {
    dirty,
    markDirty: () => setDirty(true),
    clearDirty: () => setDirty(false),
    confirmDiscard,
  };
}
