import { EcranProvisoire } from '@/composants/ecran-provisoire';

// Coquille posée par P1.13a (écran compte). Le contenu réel — formulaire du profil actif,
// date de naissance en lecture seule, bouton d'enregistrement inactif tant que rien n'a
// changé — arrive à P1.13b (docs/ecrans/L1-09-mes-informations.md, « Mes informations »).
export default function Informations() {
  return <EcranProvisoire titre="Mes informations" lot="L1" />;
}
