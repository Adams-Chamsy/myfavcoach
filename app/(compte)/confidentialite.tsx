import { EcranProvisoire } from '@/composants/ecran-provisoire';

// Coquille posée par P1.13a (écran compte). Le contenu réel — interrupteur de consentement aux
// données de santé avec sa version datée, retrait à double conséquence, effacement des mesures
// — arrive à P1.13d (docs/ecrans/L1-09-mes-informations.md, « Confidentialité »).
export default function Confidentialite() {
  return <EcranProvisoire titre="Confidentialité" lot="L1" />;
}
