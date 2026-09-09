import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone, type NomIcone } from '@/composants/icones';
import { disciplinesCoach } from '@/fixtures/demonstration';
import { EnteteOnboarding } from '@/fonctionnalites/identite/entete-onboarding';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-08-activation-espace-coach.md. Remplace la coquille posée par P1.12. Crée le
// profil coach, et RIEN de plus : un compte reste un compte, le profil client n'est pas effacé,
// l'adresse ne change pas.
//
// HORS PÉRIMÈTRE, et le sujet y attire : le dépôt de pièces / l'IBAN (écran 23) est L2, le
// premier lancement coach (écran 19) est L2, le prestataire de paiement est L4. Rien ici ne
// les touche.
//
// La création est ATOMIQUE : port.creerProfilCoach appelle la fonction de base
// creer_profil_coach (0005), qui insère le profil ET passe le profil actif à 'coach' dans une
// seule transaction. Pas deux appels enchaînés depuis l'application.

const REASSURANCES: { icone: NomIcone; texte: string }[] = [
  {
    icone: 'securite',
    texte: 'La vérification de ton identité viendra ensuite. Tu peux préparer ton profil avant.',
  },
  { icone: 'virement', texte: 'Pour être payé, il faudra une vérification complète.' },
  { icone: 'favori', texte: 'Les 3 premiers mois sont sans commission.' },
];

// Format français, indicatif fixé (fiche) : national (0X…) ou +33, 10 chiffres après le 0.
// Champ ne valide rien — c'est ici. Séparateurs (espaces, points, tirets) tolérés à la saisie,
// retirés avant contrôle et avant envoi.
function nettoyerTelephone(valeur: string): string {
  return valeur.replace(/[\s.\-]/g, '');
}

function telephoneValide(valeur: string): boolean {
  return /^(?:\+33|0)[1-9]\d{8}$/.test(nettoyerTelephone(valeur));
}

export default function DevenirCoach() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profils, port, rafraichir } = useDonnees();

  // Repris du profil client s'il existe, sans redemander (fiche, Règles + critère 6). Le nom
  // du client est facultatif (docs/domaine.md §3.2) alors que celui du coach est requis : si le
  // client n'a pas de nom, on le demande quand même.
  const prenomReprise = profils?.identiteActive.prenom ?? '';
  const nomReprise = profils?.identiteActive.nom ?? '';

  const [disciplineChoisie, setDisciplineChoisie] = useState<string | null>(null);
  const [telephone, setTelephone] = useState('');
  const [erreurTelephone, setErreurTelephone] = useState<string | undefined>();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const prenomFinal = prenomReprise || prenom.trim();
  const nomFinal = nomReprise || nom.trim();
  const pretAValider =
    disciplineChoisie !== null &&
    telephoneValide(telephone) &&
    prenomFinal !== '' &&
    nomFinal !== '';

  async function surValider() {
    if (!disciplineChoisie) return;
    setErreur(null);
    setChargement(true);
    const resultat = await port.creerProfilCoach({
      discipline: disciplineChoisie,
      telephone: nettoyerTelephone(telephone),
      prenom: prenomFinal,
      nom: nomFinal,
    });
    if (!resultat.succes) {
      setChargement(false);
      setErreur(resultat.erreur);
      return;
    }
    // Le profil coach n'existait pas au dernier lireEtatProfils : sans ce rafraîchissement, la
    // feuille de bascule montrerait "Devenir coach" au lieu de "Espace coach" dans cette même
    // session (FournisseurDonnees, en-tête).
    await rafraichir();
    setChargement(false);
    // Arrive sur le pilotage provisoire du lot L0 (fiche, "Après validation"). Un rechargement
    // complet y revient : le profil actif est côté serveur (critère 2).
    router.replace('/(coach)/pilotage');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <EnteteOnboarding etape={1} desactive={chargement} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[2],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Ouvre ton espace coach.
        </Text>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          Ton compte reste le même. Tu passeras de l’un à l’autre quand tu veux.
        </Text>

        <View style={{ gap: theme.espace[3] }}>
          {REASSURANCES.map((ligne) => (
            <View
              key={ligne.icone}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.espace[3] }}
            >
              <Icone nom={ligne.icone} couleur={theme.couleur.texte.secondaire} />
              <Text
                style={{ ...theme.texte.petit, flex: 1, color: theme.couleur.texte.secondaire }}
              >
                {ligne.texte}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: theme.espace[2] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Discipline
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
            {disciplinesCoach.map((discipline) => (
              <Chip
                key={discipline.cle}
                variante="selection"
                libelle={discipline.libelle}
                selectionne={disciplineChoisie === discipline.cle}
                onPress={() => setDisciplineChoisie(discipline.cle)}
              />
            ))}
          </View>
        </View>

        {prenomReprise === '' ? (
          <Champ
            libelle="Prénom"
            valeur={prenom}
            onChangeTexte={setPrenom}
            desactive={chargement}
          />
        ) : null}
        {nomReprise === '' ? (
          <Champ libelle="Nom" valeur={nom} onChangeTexte={setNom} desactive={chargement} />
        ) : null}

        <Champ
          libelle="Téléphone"
          type="telephone"
          valeur={telephone}
          onChangeTexte={(valeur) => {
            setTelephone(valeur);
            if (erreurTelephone) setErreurTelephone(undefined);
          }}
          onBlur={() => {
            if (telephone !== '' && !telephoneValide(telephone)) {
              setErreurTelephone('Numéro de téléphone français attendu.');
            }
          }}
          messageErreur={erreurTelephone}
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
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
          backgroundColor: theme.couleur.fond.canevas,
        }}
      >
        <Bouton
          libelle="Ouvrir mon espace coach"
          variante="primaire"
          onPress={surValider}
          desactive={!pretAValider || chargement}
        />
      </View>
    </View>
  );
}
