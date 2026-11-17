import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { EcranProgramme } from '@/fonctionnalites/studio/ecran-programme';

// docs/ecrans/L6-11-studio.md, « Un programme ».
export default function ProgrammeEcran() {
  const router = useRouter();
  const { programmeId } = useLocalSearchParams<{ programmeId?: string }>();
  if (!programmeId) return <Redirect href={'/(coach)/studio' as Href} />;
  return (
    <EcranProgramme
      programmeId={programmeId}
      onRetour={() =>
        router.canGoBack() ? router.back() : router.replace('/(coach)/studio' as Href)
      }
      onOuvrirSeance={(seanceId) =>
        router.push(
          `/(coach)/studio/seance/${encodeURIComponent(seanceId)}?programme=${encodeURIComponent(programmeId)}` as Href,
        )
      }
    />
  );
}
