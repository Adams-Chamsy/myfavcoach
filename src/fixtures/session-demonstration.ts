import { objectifsOnboarding, rythmesOnboarding } from './demonstration';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';

// Mise en scène de démonstration partagée : un compte vérifié et connecté (Camille Dupont),
// avec un profil client déjà rempli — objectifs, rythme, point de départ. Une SEULE source
// pour la galerie (section « Écrans du lot L1 », app/_galerie.tsx) ET pour le corpus de
// `npm run test:a11y` (src/test/accessibilite.test.tsx), plutôt que deux préparations qui
// dériveraient l'une de l'autre.
//
// `inscrire`/`connecter` restent asynchrones même sur le faux port : à appeler une fois (un
// `useEffect` côté galerie, un `beforeAll` côté test), jamais pendant un rendu.
//
// Réservée au développement et aux tests : elle passe par les crochets `...PourTest` du faux
// port. `app/_galerie.tsx` (seul consommateur applicatif) est retiré du bundle de production
// par `metro.config.js` (resolver.blockList).
export async function creerSessionDemonstration(): Promise<{
  portAuth: ReturnType<typeof creerFauxPortAuth>;
  portDonnees: ReturnType<typeof creerFauxPortDonnees>;
}> {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  await portDonnees.creerProfilClient('Camille', 'Dupont');
  await portDonnees.enregistrerObjectifsEtRythme(
    [objectifsOnboarding[0].cle, objectifsOnboarding[1].cle],
    rythmesOnboarding[1].cle,
  );
  await portDonnees.enregistrerPointDeDepart({
    consentementAccorde: true,
    versionConsentement: '2026-09-04',
    poidsDepartGrammes: 70500,
    poidsCibleGrammes: 65000,
  });

  return { portAuth, portDonnees };
}
