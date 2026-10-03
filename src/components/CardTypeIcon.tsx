import type { CardTypeId, DeckDisplayGroupId } from "@/lib/card-type-groups";

export type CardTypeIconType = CardTypeId | DeckDisplayGroupId;

function IconDrawing({ type }: { type: CardTypeIconType }) {
  switch (type) {
    case "creature":
      return <><path d="M7.2 10.8 5 7.7M10.4 9.6 9.2 5.5M13.8 9.7l.7-4.1M16.8 11l2-3.1" /><path d="M6.7 11.2c-2.2 1.1-2.7 3.7-.9 5.2 1.4 1.2 3 .3 4.3 1.1 1.7 1 3.1 2.1 5.2 1.2 2.4-1.1 2.5-4.3.5-6.1-2.5-2.3-6.3-3-9.1-1.4Z" /></>;
    case "instant":
    case "spell":
      return <path d="m13.5 2.8-7 10.1h5l-1 8.3 7-11.1h-5l1-7.3Z" />;
    case "sorcery":
      return <><path d="M12.2 3.2c.5 3.1-3.4 4.3-3.4 8.2 0 2 1.4 3.5 3.3 3.5 2.3 0 4-1.8 4-4.3 0-2.3-1.4-4.8-3.9-7.4Z" /><path d="M5.5 19.5h13" /></>;
    case "artifact":
      return <><path d="m12 3 7 4-7 4-7-4 7-4Z" /><path d="m5 7 7 4v9l-7-4V7Zm14 0-7 4v9l7-4V7Z" /></>;
    case "enchantment":
      return <><circle cx="12" cy="12" r="8.2" /><path d="M12 6.5c.5 3.4 2.1 5 5.5 5.5-3.4.5-5 2.1-5.5 5.5-.5-3.4-2.1-5-5.5-5.5 3.4-.5 5-2.1 5.5-5.5Z" /></>;
    case "planeswalker":
      return <><path d="M5 12c2.2-5.3 5.1-7.9 9-8.7M19 12c-2.2 5.3-5.1 7.9-9 8.7" /><circle cx="12" cy="8.5" r="1.8" /><path d="m9.3 17 1-5h3.4l1 5M7.5 12h9" /></>;
    case "land":
      return <><path d="m3 18 5.3-8.2 3.1 4.1 3.2-5.2L21 18H3Z" /><path d="m6.9 12 1.5 1.1 1.2-1" /></>;
    case "basic":
      return <><path d="m4 17 7.2-10 7.1 10H4Z" /><path d="m8.5 11 2 1.5 1.8-1.4M8 20h8" /></>;
    case "permanent":
      return <><rect x="6" y="4" width="12" height="6" rx="2" transform="rotate(45 12 7)" /><rect x="6" y="9" width="12" height="6" rx="2" transform="rotate(45 12 12)" /><rect x="6" y="14" width="12" height="6" rx="2" transform="rotate(45 12 17)" /></>;
    case "other":
      return <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9.5 9a2.7 2.7 0 1 1 3.6 2.5c-.8.4-1.1.9-1.1 1.8M12 17h.01" /></>;
  }
}

/** Decorative icon for either a full taxonomy ID or a deck display group ID. */
export function CardTypeIcon({ type }: { type: CardTypeIconType }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <IconDrawing type={type} />
    </svg>
  );
}
