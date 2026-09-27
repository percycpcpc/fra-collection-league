import { DeckEditor } from "@/components/DeckEditor";

export default async function DeckPage({ params }: { params: Promise<{ id: string; deckId: string }> }) {
  const { id, deckId } = await params;
  return <DeckEditor profileId={id} deckId={deckId} />;
}
