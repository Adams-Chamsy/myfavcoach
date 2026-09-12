import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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

// Voir le commentaire sur son unique lecture, plus bas : jamais vrai avant qu'Abonnement existe.
const ABONNEMENT_ACTIF = false;

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

  const pretAConfirmer = saisie === MOT_CONFIRMATION;

  // Bandeau coach (fiche, § « Côté coach ») : réel, offres existe depuis P2.2. Le bandeau
  // client équivalent (abonnement actif) ne peut jamais se déclencher à ce lot : aucune table
  // Abonnement n'existe (docs/dette.md, L4/L7) — omission honnête, pas un oubli.
  useEffect(() => {
    let monte = true;
    if (profils?.profilActif === 'coach' && profils.coachExiste) {
      void port.lireMesOffres().then((offres) => {
        if (monte) setOffresPubliees(offres.some((offre) => offre.publieeLe !== null));
      });
    }
    return () => {
      monte = false;
    };
  }, [port, profils?.profilActif, profils?.coachExiste]);

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
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
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

      <ScrollView
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

        {/* Bandeau client (fiche, « Si un abonnement est actif ») : ABONNEMENT_ACTIF est
            littéralement `false`, jamais lu depuis un état réel — aucune table Abonnement
            n'existe avant L4 (paiement, docs/perimetre.md) / L7 (pilotage réel), donc rien ne
            peut l'alimenter à ce lot. Gardé ici, visible et mort plutôt que retiré, pour que le
            jour où `useDonnees()` expose un abonnement réel, il suffise de remplacer cette seule
            constante par la lecture — docs/dette.md. */}
        {profils?.profilActif === 'client' && ABONNEMENT_ACTIF ? (
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            Ton abonnement est actif. Supprimer ton compte résilie ton suivi. Le mois déjà payé
            n’est pas remboursé.
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

        {erreur ? (
          <View accessibilityLiveRegion="polite">
            <EtatErreur
              titre={textesRepliErreur.serveur.titre}
              explication={erreur}
              nombreEchecs={0}
              onReessayer={() => {}}
              onNousEcrire={() => {}}
            />
          </View>
        ) : null}
      </ScrollView>

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
    </View>
  );
}
