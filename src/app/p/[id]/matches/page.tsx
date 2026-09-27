import { ProfileMatches } from "@/components/ProfileMatches";

export default async function ProfileMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfileMatches profileId={id} />;
}
