import { EcranProvisoire } from '@/composants/ecran-provisoire';

// docs/ecrans/L0-04-demarrage.md, sequence 6 : "aucun jeton -> /(public)/accueil (ecran
// provisoire, remplace en L1)".
export default function AccueilPublic() {
  return <EcranProvisoire titre="Accueil" lot="L1" />;
}
