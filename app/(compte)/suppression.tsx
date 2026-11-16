import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Champ } from '@/composants/champ';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useTheme } from '@/theme/fournisseur';

// L2-01 (C-03). Confirmation par SAISIE du mot « SUPPRIMER », pas une case à cocher (fiche,
// Contenu) — pas de seconde modale par-dessus, la saisie est déjà le geste qui coûte.
const MOT_CONFIRMATION = 'SUPPRIMER';

// Bandeau client (fiche, « Si un abonnement est actif »). Le texte au singulier est celui de la
// fiche ; le pluriel et la variante sans prénom (coach devenu illisible) en sont dérivés.
function texteAbonnementsActifs(prenoms: (string | null)[]): string {
  const connus = prenoms.filter((p): p is string => p !== null && p.trim() !== '');
  const avec =
    connus.length === 0
      ? ''
      : ` avec ${connus.length === 1 ? connus[0] : `${connus.slice(0, -1).join(', ')} et ${connus[connus.length - 1]}`}`;
  return prenoms.length === 1
    ? `Ton abonnement est actif. Supprimer ton compte résilie ton suivi${avec}. Le mois déjà payé n’est pas remboursé.`
    : `Tes abonnements sont actifs. Supprimer ton compte résilie tes suivis${avec}. Le mois déjà payé n’est pas remboursé.`;
}

export default function Suppression() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port, profils } = useDonnees();
  const { port: portAuth } = useSession();

  const [saisie, setSaisie] = useState('');
  const [motif, setMotif] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [offresPubliees, setOffresPubliees] = useState(false);
  // Les prénoms des coachs des abonnements ACTIFS du client ; vide : pas de bandeau.
  const [coachsActifs, setCoachsActifs] = useState<(string | null)[]>([]);

  const pretAConfirmer = saisie === MOT_CONFIRMATION;

  // Bandeau coach (fiche, § « Côté coach ») : réel, offres existe depuis P2.2. Bandeau client :
  // réel depuis le 16 novembre 2026 — les abonnements existent (L4) et la suppression les résilie
  // côté serveur (0068). Chacun ne lit que l'espace actif (CLAUDE.md §10). Une lecture en échec
  // ne montre pas de bandeau et ne bloque rien : le serveur résilie de toute façon.
  useEffect(() => {
    let monte = true;
    if (profils?.profilActif === 'coach' && profils.coachExiste) {
      void port.lireMesOffres().then((offres) => {
        if (monte) setOffresPubliees(offres.some((offre) => offre.publieeLe !== null));
      });
    }
    if (profils?.profilActif === 'client' && profils.clientExiste) {
      void port
        .lireMesAbonnements()
        .then((abonnements) => {
          if (monte) {
            setCoachsActifs(
              abonnements.filter((a) => a.statut === 'actif').map((a) => a.coachPrenom),
            );
          }
        })
        .catch(() => {});
    }
    return () => {
      monte = false;
    };
  }, [port, profils?.profilActif, profils?.coachExiste, profils?.clientExiste]);

  async function surSupprimer() {
    setErreur(null);
    setChargement(true);
    const resultat = await port.demanderSuppressionCompte(
      motif.trim() === '' ? null : motif.trim(),
    );
    if (!resultat.succes) {
      setChargement(false);
      setErreur(resultat.erreur);
      return;
    }
    await portAuth.deconnecter();
    router.replace('/(public)' as Href);
  }

  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.espace[3],
          paddingTop: insets.top + theme.espace[2],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[3],
        }}
      >
        <BoutonIcone nom="retour" accessibilityLabel="Retour" onPress={() => router.back()} />
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Ce qui disparaît, et quand.
        </Text>
      </View>

      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <View style={{ flexDirection: 'row', gap: theme.espace[3] }}>
          <Icone nom="fermer" couleur={theme.couleur.etat.erreur} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}>
              Tout de suite
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Ton profil, tes objectifs, ton poids, tes mesures et tes échanges.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.espace[3] }}>
          <Icone nom="duree" couleur={theme.couleur.texte.secondaire} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}>
              Conservé 10 ans
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Tes factures, parce que la loi l’exige. Elles ne contiennent aucune donnée de santé.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.espace[3] }}>
          <Icone nom="suivant" couleur={theme.couleur.texte.secondaire} />
          <View style={{ flex: 1, gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}>
              À récupérer avant
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Tu peux exporter tes données. Après suppression, ce n’est plus possible.
            </Text>
          </View>
        </View>

        {profils?.profilActif === 'coach' && offresPubliees ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            Tes offres sont retirées ; tes abonnés en cours gardent l’accès jusqu’à la fin de leur
            période payée.
          </Text>
        ) : null}

        {profils?.profilActif === 'client' && coachsActifs.length > 0 ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            {texteAbonnementsActifs(coachsActifs)}
          </Text>
        ) : null}

        <Champ
          libelle="Écris SUPPRIMER pour confirmer"
          valeur={saisie}
          onChangeTexte={setSaisie}
          desactive={chargement}
        />

        <Champ
          libelle="Dis-nous pourquoi (facultatif)"
          valeur={motif}
          onChangeTexte={setMotif}
          desactive={chargement}
        />
      </DefilementEcran>

      {/* Hors de la zone de défilement : un message d'erreur doit être dans le champ de vision
          (2 novembre 2026, docs/prompts/defauts-L2-iphone.md, partie B). « Réessayer » relance
          vraiment l'envoi ; le détail est le repli serveur, jamais le texte du port, qui
          répétait le titre. */}
      <View style={{ paddingHorizontal: theme.espace.gouttiere }}>
        {erreur ? (
          <View accessibilityLiveRegion="polite">
            <EtatErreur
              titre={textesRepliErreur.serveur.titre}
              explication={textesRepliErreur.serveur.explication}
              nombreEchecs={0}
              onReessayer={() => void surSupprimer()}
            />
          </View>
        ) : null}
      </View>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
          gap: theme.espace[2],
        }}
      >
        <Bouton
          libelle="Exporter mes données d’abord"
          variante="secondaire"
          onPress={() => router.push('/(compte)/export' as Href)}
          desactive={chargement}
        />
        <Bouton
          libelle="Supprimer définitivement"
          variante="destructeur"
          onPress={() => void surSupprimer()}
          desactive={!pretAConfirmer || chargement}
        />
      </View>
    </CanevasEcran>
  );
}
