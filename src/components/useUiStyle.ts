"use client";

import { useEffect, useState } from "react";

export type UiStyle = "alt" | "classic";

export function useUiStyle() {
  const [style, setStyle] = useState<UiStyle>("classic");

  useEffect(() => {
    if (window.localStorage.getItem("fra-ui-style") === "alt") setStyle("alt");
  }, []);

  function toggle() {
    setStyle((current) => {
      const next = current === "alt" ? "classic" : "alt";
      window.localStorage.setItem("fra-ui-style", next);
      return next;
    });
  }

  return { style, toggle };
}
