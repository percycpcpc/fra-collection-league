"use client";

import { useEffect, useState } from "react";
import { cardImage } from "@/lib/client";

export function PlayerAvatar({ name, iconCard, size = 24 }: { name: string; iconCard?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [iconCard]);

  const style = { width: size, height: size };
  if (!iconCard || failed) {
    return <span className="player-avatar player-avatar-initial" style={style} aria-label={`${name} icon`}>{name.slice(0, 1).toUpperCase()}</span>;
  }

  return (
    // External catalog redirects make a plain img appropriate here.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="player-avatar" style={style} src={cardImage(iconCard)} alt={`${name} icon`} loading="lazy" onError={() => setFailed(true)} />
  );
}
