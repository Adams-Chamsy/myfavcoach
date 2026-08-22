import { useLocalSearchParams } from 'expo-router';

import { EcranProvisoire } from '@/composants/ecran-provisoire';

// Cible des trois entrées de la feuille "Créer" (docs/ecrans/L0-02-coquille-coach.md). Dans le
// groupe app/(coach)/, pas en dehors : ce sont des écrans de l'espace coach, et les en sortir
// les rendrait atteignables depuis l'espace client sans aucune barrière, ce qui deviendrait un
// problème d'autorisation dès que L1 posera la vérification de profil sur le groupe. Le lot de
// traitement vient de docs/perimetre.md (écrans 11 « Studio de contenu » et 03 « Profil coach —
// offres »).
const CONFIGURATION: Record<string, { titre: string; lot: string }> = {
  programme: { titre: 'Nouveau programme', lot: 'L6' },
  seance: { titre: 'Nouvelle séance', lot: 'L6' },
  offre: { titre: 'Nouvelle offre', lot: 'L2' },
};

export default function Creer() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const configuration = CONFIGURATION[type ?? ''];

  return (
    <EcranProvisoire titre={configuration?.titre ?? 'Créer'} lot={configuration?.lot ?? '?'} />
  );
}
