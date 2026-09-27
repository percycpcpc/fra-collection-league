import { DeckList } from "@/components/DeckList";

export default async function DecksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeckList profileId={id} />;
}
