import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';

import { EcranProvisoire } from '@/composants/ecran-provisoire';
import { AttenteVerification } from '@/fonctionnalites/coach/attente-verification';
import { CarteImporterClients } from '@/fonctionnalites/coach/carte-importer-clients';
import { EnTeteEspaceCoach } from '@/fonctionnalites/coach/en-tete-espace-coach';
import { PremierLancement, type LigneMiseEnRoute } from '@/fonctionnalites/coach/premier-lancement';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import type { DossierVerification, Offre } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// Écran 08 (docs/perimetre.md). L2-09 et L2-11 (docs/prompts/L2.md P2.9) : tant que le dossier
// n'est pas `verifiee`, cette route rend L2-09 EN ENTIER (pas une carte ajoutée) ; une fois
// vérifié, L2-11 tant qu'aucune offre n'est publiée (proxy le plus honnête disponible à ce lot
// pour "aucun abonné actif" — Abonnement n'existe pas encore, L4/L7). Au-delà, l'écran de
// pilotage (L7) reste provisoire, à une exception près : la carte d'entrée L3bis vers
// « Importer mes clients » (docs/ecrans/L3bis-I01-inviter-mes-clients.md, Règles), seul chemin
// qui rend I-01 atteignable à ce lot.
export default function Pilotage() {
  const theme = useTheme();
  const router = useRouter();
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

  // Le contenu dépend de l'état du coach ; l'EN-TÊTE, avec l'avatar de la bascule, n'en dépend
  // jamais (en-tete-espace-coach.tsx : une sortie qui vit dans une branche disparaît avec elle).
  let titre = 'Espace coach';
  let contenu: ReactNode;
  if (!profils || profils.profilActif !== 'coach' || !profils.coachExiste || !dossier || !offres) {
    contenu = <View style={{ flex: 1 }} />;
  } else if (dossier.statut !== 'verifiee') {
    contenu = <AttenteVerification dossier={dossier} />;
  } else if (!offres.some((o) => o.publieeLe !== null && o.retireeLe === null)) {
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
    titre = `Bienvenue ${profils.identiteActive.prenom}`;
    contenu = <PremierLancement lignes={lignes} />;
  } else {
    contenu = (
      <>
        <CarteImporterClients onPress={() => router.push('/(coach)/invitations')} />
        <EcranProvisoire titre="Pilotage" lot="L7" />
      </>
    );
  }

  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
        <EnTeteEspaceCoach
          titre={titre}
          nomAvatar={nom}
          onOuvrirBascule={() => setFeuilleOuverte(true)}
        />
        {contenu}
      </View>
    </FeuilleBascule>
  );
}
