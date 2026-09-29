"use client";

import { useState } from "react";
import { cardImage, type CatalogCard } from "@/lib/client";

export function CardImage({ name, catalog, onClick, dimmed = false, ariaLabel }: { name: string; catalog?: CatalogCard; onClick?: () => void; dimmed?: boolean; ariaLabel?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <button className={`card-placeholder ${dimmed ? "dimmed" : ""}`} onClick={onClick} type="button">{dimmed && <span className="unowned-marker" aria-hidden="true">✕</span>}<span>Image unavailable</span><strong>{name}</strong></button>;
  return (
    <button className={`card-image-button ${dimmed ? "dimmed" : ""}`} onClick={onClick} type="button" disabled={!onClick} aria-label={onClick ? ariaLabel || `Toggle owned status for ${name}` : undefined}>
      {dimmed && <span className="unowned-marker" aria-hidden="true">✕</span>}
      {/* External catalog URLs and Scryfall redirects make a plain img appropriate here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cardImage(name, catalog)} alt={name} loading="lazy" onError={() => setFailed(true)} />
    </button>
  );
}
