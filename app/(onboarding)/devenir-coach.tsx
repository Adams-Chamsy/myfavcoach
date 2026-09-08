import { EcranProvisoire } from '@/composants/ecran-provisoire';

// docs/ecrans/L1-08-activation-espace-coach.md. PROVISOIRE : posé par P1.12 (docs/prompts/L1.md)
// seulement pour que « Devenir coach » (feuille de bascule, L1-06) mène quelque part plutôt
// qu'à une route absente. Le contenu réel — les deux champs, la création atomique du profil
// coach — est P1.14.
export default function DevenirCoach() {
  return <EcranProvisoire titre="Devenir coach" lot="L1" />;
}
