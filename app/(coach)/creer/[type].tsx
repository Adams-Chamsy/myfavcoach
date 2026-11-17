import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { EcranProvisoire } from '@/composants/ecran-provisoire';
import { EcranCreationOffre } from '@/fonctionnalites/offres/ecran-creation-offre';

// Cible des trois entrées de la feuille "Créer" (docs/ecrans/L0-02-coquille-coach.md). Dans le
// groupe app/(coach)/, pas en dehors : ce sont des écrans de l'espace coach, et les en sortir
// les rendrait atteignables depuis l'espace client sans aucune barrière, ce qui deviendrait un
// problème d'autorisation dès que L1 posera la vérification de profil sur le groupe. Le lot de
// traitement vient de docs/perimetre.md (écrans 11 « Studio de contenu » et 03 « Profil coach —
// offres »).
const CONFIGURATION: Record<string, { titre: string; lot: string }> = {
  offre: { titre: 'Nouvelle offre', lot: 'L2' },
};

export default function Creer() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();

  // L2-15 (docs/prompts/L2.md P2.10) : seule "offre" a un écran réel à ce lot. programme/seance
  // restent la coquille provisoire (L6, hors périmètre).
  if (type === 'offre')
    return (
      <EcranCreationOffre
        onFermer={() =>
          // Ouvert depuis la feuille « Créer » : on revient d'où l'on vient. Atteint sans rien
          // derrière (lien direct, rechargement web), on retombe sur le pilotage.
          router.canGoBack() ? router.back() : router.replace('/(coach)/(tabs)/pilotage' as Href)
        }
      />
    );

  // L6 (docs/ecrans/L6-11-studio.md, « Entrées ») : « Nouveau programme » ouvre le studio, qui
  // le crée ; « Nouvelle séance » ouvre la liste des programmes, une séance s'ajoutant dans l'un
  // d'eux. Remplacement, pas empilement : la feuille Créer ne reste pas derrière.
  if (type === 'programme') return <Redirect href={'/(coach)/studio?nouveau=1' as Href} />;
  if (type === 'seance') return <Redirect href={'/(coach)/studio?pour=seance' as Href} />;

  const configuration = CONFIGURATION[type ?? ''];
  return (
    <EcranProvisoire titre={configuration?.titre ?? 'Créer'} lot={configuration?.lot ?? '?'} />
  );
}
