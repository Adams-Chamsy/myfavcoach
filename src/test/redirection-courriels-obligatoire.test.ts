import { readFileSync } from 'fs';
import { join } from 'path';

// Trois appels au SDK Supabase envoient un courriel avec un lien de confirmation, et exigent
// chacun un `emailRedirectTo`/`redirectTo` explicite — sans lui, GoTrue retombe sur `site_url`,
// jamais sur le lien profond de l'application (voir le commentaire en tête de
// src/services/auth/supabase.ts). Deux trous de ce genre (inscrire, renvoyerVerification) ont
// déjà existé, non remarqués, depuis P1.8 avant d'être trouvés en écrivant P1.9.
//
// Rendu structurel plutôt que documenté : ces trois appels SDK ne doivent apparaître qu'UNE
// SEULE FOIS dans le fichier, chacun dans sa fonction d'enveloppe dédiée
// (envoyerCourrielInscription, renvoyerCourrielVerification, envoyerCourrielReinitialisation) —
// le lien profond y est câblé en dur, jamais un paramètre qu'un appelant pourrait omettre. Un
// second appel direct ailleurs dans le fichier, même correct aujourd'hui, contournerait cette
// garantie le jour où quelqu'un l'oublierait — c'est exactement ce que ce test empêche.
const CHEMIN_SUPABASE_TS = join(__dirname, '..', 'services', 'auth', 'supabase.ts');

const APPELS_DEVANT_RESTER_UNIQUES = [
  'supabase.auth.signUp(',
  'supabase.auth.resend(',
  'supabase.auth.resetPasswordForEmail(',
];

describe('les appels Supabase qui envoient un courriel passent tous par leur enveloppe dédiée', () => {
  const source = readFileSync(CHEMIN_SUPABASE_TS, 'utf8');

  it.each(APPELS_DEVANT_RESTER_UNIQUES)(
    '%s apparaît exactement une fois dans supabase.ts (sa fonction d’enveloppe, jamais ailleurs)',
    (appel) => {
      const occurrences = source.split(appel).length - 1;
      expect(occurrences).toBe(1);
    },
  );
});
