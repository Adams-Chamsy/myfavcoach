import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { EcranProvisoire } from '@/composants/ecran-provisoire';
import { AttenteVerification } from '@/fonctionnalites/coach/attente-verification';
import { PremierLancement, type LigneMiseEnRoute } from '@/fonctionnalites/coach/premier-lancement';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import type { DossierVerification, Offre } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// Écran 08 (docs/perimetre.md). L2-09 et L2-11 (docs/prompts/L2.md P2.9) : tant que le dossier
// n'est pas `verifiee`, cette route rend L2-09 EN ENTIER (pas une carte ajoutée) ; une fois
// vérifié, L2-11 tant qu'aucune offre n'est publiée (proxy le plus honnête disponible à ce lot
// pour "aucun abonné actif" — Abonnement n'existe pas encore, L4/L7). Au-delà, l'écran normal de
// pilotage (L7) reprend, toujours provisoire ici.
export default function Pilotage() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profils, port } = useDonnees();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [dossier, setDossier] = useState<DossierVerification | null>(null);
  const [offres, setOffres] = useState<Offre[] | null>(null);
  const [informationsCompletes, setInformationsCompletes] = useState(false);

  const nom = profils
    ? [profils.identiteActive.prenom, profils.identiteActive.nom].filter(Boolean).join(' ')
    : '';

  useEffect(() => {
    if (!profils || profils.profilActif !== 'coach' || !profils.coachExiste) return;
    let monte = true;
    void Promise.all([
      port.lireDossierVerification(),
      port.lireMesOffres(),
      port.lireInformations(),
    ]).then(([d, o, info]) => {
      if (!monte) return;
      setDossier(d);
      setOffres(o);
      setInformationsCompletes(info.profil === 'coach' && !!info.titreCourt && !!info.bio);
    });
    return () => {
      monte = false;
    };
  }, [port, profils]);

  if (!profils || profils.profilActif !== 'coach' || !profils.coachExiste || !dossier || !offres) {
    return (
      <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
        <View style={{ flex: 1 }} />
      </FeuilleBascule>
    );
  }

  if (dossier.statut !== 'verifiee') {
    return (
      <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
        <AttenteVerification dossier={dossier} />
      </FeuilleBascule>
    );
  }

  const auMoinsUneOffrePubliee = offres.some((o) => o.publieeLe !== null && o.retireeLe === null);

  if (dossier.statut === 'verifiee' && !auMoinsUneOffrePubliee) {
    const lignes: LigneMiseEnRoute[] = [
      {
        libelle: 'Photo et bio renseignées',
        fait: informationsCompletes,
        route: '/(compte)/informations',
      },
      {
        libelle: 'Créer ta première offre',
        fait: offres.length > 0,
        route: '/(coach)/creer/offre',
      },
      { libelle: 'Vérifier ton identité', fait: true, route: '/(coach)/creer/offre' },
    ];
    return (
      <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
        <PremierLancement prenom={profils.identiteActive.prenom} lignes={lignes} />
      </FeuilleBascule>
    );
  }

  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingTop: insets.top + theme.espace[2],
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[2],
          }}
        >
          <Pressable
            onPress={() => setFeuilleOuverte(true)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la bascule d'espace"
          >
            <Avatar nom={nom} taille="md" />
          </Pressable>
        </View>

        <EcranProvisoire titre="Pilotage" lot="L7" />
      </View>
    </FeuilleBascule>
  );
}
