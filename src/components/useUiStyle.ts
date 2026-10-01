"use client";

import { useEffect, useState } from "react";

export type UiStyle = "alt" | "classic";

let cachedStyle: UiStyle | null = null;

export function useUiStyle() {
  const [style, setStyle] = useState<UiStyle>(() => cachedStyle ?? "classic");

  useEffect(() => {
    const storedStyle = window.localStorage.getItem("fra-ui-style") === "alt" ? "alt" : "classic";
    cachedStyle = storedStyle;
    if (storedStyle !== style) setStyle(storedStyle);
  }, []);

  function toggle() {
    setStyle((current) => {
      const next = current === "alt" ? "classic" : "alt";
      window.localStorage.setItem("fra-ui-style", next);
      cachedStyle = next;
      return next;
    });
  }

  return { style, toggle };
}

export function resetUiStyleCacheForTests() {
  cachedStyle = null;
}
