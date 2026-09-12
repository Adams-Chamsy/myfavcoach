// Doublure du client réel (même mock que src/services/auth/supabase.test.ts) : ce fichier ne
// veut lire qu'une constante, jamais appeler le vrai client — sans ce mock, charger le module
// exigerait un .env rempli (src/services/supabase/client.ts).
jest.mock('@/services/supabase/client', () => ({
  supabase: { auth: {} },
}));

import { VERSION_CGU_ACCEPTEE as versionEcriteAInscription } from '@/services/auth/supabase';
import { VERSION_CGU_ACCEPTEE as versionAffichee } from '@/fonctionnalites/identite/documents-legaux';

// docs/dette.md : VERSION_CGU_ACCEPTEE existe volontairement en deux copies — celle que
// src/services/auth/supabase.ts écrit réellement dans comptes.cgu_version_acceptee à
// l'inscription, et celle que src/fonctionnalites/identite/documents-legaux.ts affiche aux
// écrans (documents.tsx, le lecteur public). Une divergence entre les deux ferait enregistrer,
// pour un document CONTRACTUEL, une version différente de celle réellement montrée au compte —
// et déclencherait ou masquerait le bandeau « Une version a changé » à tort. Ce test ne résout
// pas la duplication (voir docs/dette.md pour la vraie solution : faire accepter la version en
// paramètre de PortAuth.inscrire, comme enregistrerConsentementSante), il la rend seulement
// inoffensive : toute divergence future casse `npm test` immédiatement, au lieu d'attendre
// qu'un compte réel enregistre la mauvaise version.
describe('VERSION_CGU_ACCEPTEE reste identique dans ses deux copies', () => {
  it('la version écrite à l’inscription est la même que celle affichée aux écrans', () => {
    expect(versionEcriteAInscription).toBe(versionAffichee);
  });
});
