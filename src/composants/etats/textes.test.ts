import { textesRepliErreur } from './textes';

// Critere d'acceptation 5 (docs/ecrans/L0-03-etats-systeme.md) : "Aucun des cinq textes de
// repli ne contient « erreur », « problème technique » ou « veuillez »."
describe('textesRepliErreur', () => {
  const motsInterdits = ['erreur', 'problème technique', 'veuillez'];

  it.each(Object.entries(textesRepliErreur))(
    'le texte de repli "%s" ne contient aucun mot interdit',
    (_situation, { titre, explication }) => {
      const texte = `${titre} ${explication}`.toLowerCase();

      for (const mot of motsInterdits) {
        expect(texte).not.toContain(mot);
      }
    },
  );
});
