import { CanevasEcran } from '@/composants/canevas-ecran';
import { type Href, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform } from 'react-native';

import { EnTeteEspaceCoach } from '@/fonctionnalites/coach/en-tete-espace-coach';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import { EcranRevenus } from '@/fonctionnalites/revenus/ecran-revenus';
import { useTheme } from '@/theme/fournisseur';

// Écran 13 (docs/ecrans/L5-13-revenus.md). Aucune logique ici (CLAUDE.md §5) : l'écran vit dans
// src/fonctionnalites/revenus/. L'en-tête, avec l'avatar de la bascule, est rendu au-dessus du
// contenu, jamais dans une de ses branches (CLAUDE.md §8).
export default function Revenus() {
  const theme = useTheme();
  const router = useRouter();
  const { profils } = useDonnees();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const nom = profils
    ? [profils.identiteActive.prenom, profils.identiteActive.nom].filter(Boolean).join(' ')
    : '';
  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <EnTeteEspaceCoach
          titre="Revenus"
          nomAvatar={nom}
          onOuvrirBascule={() => setFeuilleOuverte(true)}
        />
        <EcranRevenus
          onOuvrirFacturation={() => router.push('/(coach)/facturation' as Href)}
          onOuvrirFactures={() => router.push('/(compte)/factures' as Href)}
          ouvrirPage={async (url) => {
            if (Platform.OS === 'web') {
              // Même onglet, comme la page de paiement : le retour revient par l'adresse posée
              // par le serveur (?identification=retour), relayée par app/index.tsx.
              window.location.assign(url);
              return new Promise<void>(() => {});
            }
            await WebBrowser.openBrowserAsync(url);
          }}
        />
      </CanevasEcran>
    </FeuilleBascule>
  );
}
