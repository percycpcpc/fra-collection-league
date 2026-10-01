import { ProfilesDirectory } from "@/components/ProfilesDirectory";
import { parseAltSection } from "@/lib/alt-sections";

export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <ProfilesDirectory next={parseAltSection(next)} />;
}
