// Vérification de type, jamais exécutée : `@ts-expect-error` force une erreur de compilation
// si `libelle` redevient optionnel dans `ProprietesBadge`. Vérifiée par `npm run typecheck`
// (tsc --noEmit) — `tsconfig.json` compile tout `**/*.tsx`, avec ou sans import, donc ce
// fichier est bien couvert même si rien ne l'importe.
//
// Volontairement pas `badge.test.tsx` : un `it.skip` ici serait à jamais ignoré par Jest (rien
// à y exécuter, la garantie est côté compilateur), et un test ignoré pour toujours se lit comme
// un faux vert dans une sortie qui défile. En le sortant du nom `*.test.tsx`, Jest ne le voit
// plus du tout — ni vert, ni ignoré — et `npm run typecheck` continue de le vérifier.
import { Badge } from './badge';

// @ts-expect-error libelle est obligatoire dans ProprietesBadge
void (<Badge statut="succes" />);
