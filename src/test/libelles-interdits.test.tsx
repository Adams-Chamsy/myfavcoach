import { render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { libellesInterditsTrouves, LIBELLES_INTERDITS, type NoeudHote } from './libelles-interdits';

// Le détecteur lui-même (docs/domaine.md §2). Sans ce test, une liste vide ou un motif cassé
// laisserait passer tous les écrans du tunnel sans que rien ne rougisse.
describe('libellés interdits : le détecteur', () => {
  it.each([
    ['Débloque ton programme', 'débloquer'],
    ['Messagerie illimitée', 'illimité'],
    ['Une offre exclusive', 'exclusif'],
    ['Accès au contenu du coach', 'accès au contenu'],
    ['Passe en version complète', 'version complète'],
    ['Espace VIP', 'VIP'],
  ])('trouve « %s » dans un texte rendu', async (texte, terme) => {
    await render(<Text>{texte}</Text>);
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([
      `${terme} : « ${texte} »`,
    ]);
  });

  it('trouve un terme dans un libellé d’accessibilité, pas seulement dans un texte', async () => {
    await render(
      <Pressable accessibilityLabel="Contenu premium" onPress={() => {}}>
        <View />
      </Pressable>,
    );
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([
      'premium : « Contenu premium »',
    ]);
  });

  it('ne lit pas ce que personne ne lit : un identifiant de test n’est pas un texte', async () => {
    await render(<View testID="premium-illimite" />);
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });

  it('un texte du tunnel tel qu’écrit dans les fiches passe', async () => {
    await render(<Text>Suivi complet · ajustement hebdomadaire · 49 €/mois</Text>);
    expect(libellesInterditsTrouves(screen.container as unknown as NoeudHote)).toEqual([]);
  });

  it('la liste couvre les dix termes de docs/domaine.md §2', () => {
    expect(LIBELLES_INTERDITS.map((l) => l.terme)).toEqual([
      'débloquer',
      'déverrouiller',
      'premium',
      'illimité',
      'exclusif',
      'accès au contenu',
      'accéder au contenu',
      'bibliothèque',
      'VIP',
      'version complète',
    ]);
  });
});
