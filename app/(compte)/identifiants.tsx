import { EcranProvisoire } from '@/composants/ecran-provisoire';

// Coquille posée par P1.13a (écran compte). Le contenu réel — changement d'adresse avec double
// confirmation, changement de mot de passe et révocation des autres sessions — arrive à P1.13c
// (docs/ecrans/L1-09-mes-informations.md, « Adresse e-mail et mot de passe »).
export default function Identifiants() {
  return <EcranProvisoire titre="Adresse e-mail et mot de passe" lot="L1" />;
}
