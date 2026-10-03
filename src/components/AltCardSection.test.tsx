import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AltCardSection } from "./AltCardSection";

describe("AltCardSection", () => {
  it("wires the disclosure button to its mounted, visible body", () => {
    const html = renderToStaticMarkup(
      <AltCardSection id="alt-collection-type-creature" title="Creatures" count="12 cards" collapsed={false} onToggle={() => {}}>
        <button>Card action</button>
      </AltCardSection>,
    );
    expect(html).toMatch(/<h3 class="alt-card-section-heading"><button[^>]*aria-expanded="true" aria-controls="alt-collection-type-creature-body"/);
    expect(html).toContain('id="alt-collection-type-creature-body" class="alt-card-section-body"');
    expect(html).not.toMatch(/id="alt-collection-type-creature-body"[^>]*hidden/);
  });

  it("keeps a collapsed body mounted and hidden, with an optional heading level and icon", () => {
    const html = renderToStaticMarkup(
      <AltCardSection id="alt-deck-contents-type-land" title="Lands" icon={<i data-icon="land" />} collapsed onToggle={() => {}} headingLevel={2}>
        <span>Plains</span>
      </AltCardSection>,
    );
    expect(html).toMatch(/<h2 class="alt-card-section-heading"><button[^>]*aria-expanded="false" aria-controls="alt-deck-contents-type-land-body"/);
    expect(html).toMatch(/id="alt-deck-contents-type-land-body" class="alt-card-section-body" hidden=""/);
    expect(html).toContain("Plains");
    expect(html).toContain('data-icon="land"');
  });
});
