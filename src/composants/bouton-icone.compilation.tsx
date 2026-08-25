// Vérification de type, jamais exécutée : `@ts-expect-error` force une erreur de compilation
// si `accessibilityLabel` redevient optionnel dans `ProprietesBoutonIcone`. Vérifiée par
// `npm run typecheck` (tsc --noEmit) — `tsconfig.json` compile tout `**/*.tsx`, avec ou sans
// import, donc ce fichier est bien couvert même si rien ne l'importe.
//
// Volontairement pas `bouton-icone.test.tsx` : voir le commentaire de tête de
// `badge.compilation.tsx`, même raisonnement.
import { BoutonIcone } from './bouton-icone';

// @ts-expect-error accessibilityLabel est obligatoire dans ProprietesBoutonIcone
void (<BoutonIcone nom="ajouter" onPress={() => {}} />);
