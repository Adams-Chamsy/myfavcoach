import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Champ } from '@/composants/champ';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import type { ErreurAuth } from '@/services/auth/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-09-mes-informations.md, section « Adresse e-mail et mot de passe ».
//
// Adresse : le changement N'EST PAS immédiat — GoTrue envoie une confirmation à l'ANCIENNE et à
// la NOUVELLE adresse, l'adresse du compte ne change que quand les deux liens sont suivis
// (port.changerEmail passe par envoyerCourrielChangementAdresse, lien profond
// myfavcoach://auth/adresse déclaré dans supabase/config.toml). L'écran montre l'état d'attente
// tant que port.lireAdresseEnAttente() rend une adresse.
//
// Mot de passe : mot de passe actuel EXIGÉ (port.changerMotDePasseConnecte le vérifie côté
// serveur) — un téléphone brièvement déverrouillé ne doit pas suffire. Bornes 10–72 identiques
// à L1-02 (la borne haute vient de bcrypt, pas de nous). Après succès, les AUTRES sessions ne
// peuvent plus se reconnecter ; leur jeton d'accès déjà émis, lui, reste valable jusqu'à sa
// propre expiration (≤ 1 h) — le message le dit, il ne promet pas une coupure immédiate.

const LONGUEUR_MOT_DE_PASSE_MIN = 10;
const LONGUEUR_MOT_DE_PASSE_MAX = 72;

function adresseValide(valeur: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());
}

function messageErreurAuth(erreur: ErreurAuth): string {
  if (erreur.code === 'identifiants_invalides') return 'Mot de passe actuel incorrect.';
  if (erreur.code === 'reseau') return 'Pas de connexion. Réessaie.';
  if (erreur.code === 'limite_debit') return 'Trop d’essais. Réessaie dans quelques minutes.';
  return 'On a un souci de notre côté. Ce n’est pas toi.';
}

export default function Identifiants() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, port } = useSession();

  const [adresseEnAttente, setAdresseEnAttente] = useState<string | null>(null);
  const [nouvelleAdresse, setNouvelleAdresse] = useState('');
  const [erreurAdresse, setErreurAdresse] = useState<string | undefined>();
  const [envoiAdresse, setEnvoiAdresse] = useState(false);

  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | undefined>();
  const [erreurGlobaleMotDePasse, setErreurGlobaleMotDePasse] = useState<string | undefined>();
  const [motDePasseChange, setMotDePasseChange] = useState(false);
  const [changementEnCours, setChangementEnCours] = useState(false);

  useEffect(() => {
    let monte = true;
    port.lireAdresseEnAttente().then((adresse) => {
      if (monte) setAdresseEnAttente(adresse);
    });
    return () => {
      monte = false;
    };
  }, [port]);

  async function envoyerConfirmationAdresse() {
    if (!adresseValide(nouvelleAdresse)) {
      setErreurAdresse('Adresse e-mail incomplète.');
      return;
    }
    setErreurAdresse(undefined);
    setEnvoiAdresse(true);
    const resultat = await port.changerEmail(nouvelleAdresse.trim());
    setEnvoiAdresse(false);
    if (!resultat.succes) {
      setErreurAdresse(messageErreurAuth(resultat.erreur));
      return;
    }
    setAdresseEnAttente(nouvelleAdresse.trim());
    setNouvelleAdresse('');
  }

  async function renvoyerConfirmationAdresse() {
    if (!adresseEnAttente) return;
    setEnvoiAdresse(true);
    await port.changerEmail(adresseEnAttente);
    setEnvoiAdresse(false);
  }

  function validerNouveauMotDePasse(valeur: string): boolean {
    if (valeur.length < LONGUEUR_MOT_DE_PASSE_MIN) {
      setErreurMotDePasse('Il faut au moins 10 caractères.');
      return false;
    }
    if (valeur.length > LONGUEUR_MOT_DE_PASSE_MAX) {
      setErreurMotDePasse('72 caractères au maximum.');
      return false;
    }
    setErreurMotDePasse(undefined);
    return true;
  }

  const nouveauMotDePasseValide =
    nouveauMotDePasse.length >= LONGUEUR_MOT_DE_PASSE_MIN &&
    nouveauMotDePasse.length <= LONGUEUR_MOT_DE_PASSE_MAX;

  async function changerMotDePasse() {
    if (!validerNouveauMotDePasse(nouveauMotDePasse)) return;
    setErreurGlobaleMotDePasse(undefined);
    setMotDePasseChange(false);
    setChangementEnCours(true);
    const resultat = await port.changerMotDePasseConnecte(motDePasseActuel, nouveauMotDePasse);
    setChangementEnCours(false);
    if (!resultat.succes) {
      setErreurGlobaleMotDePasse(messageErreurAuth(resultat.erreur));
      return;
    }
    setMotDePasseActuel('');
    setNouveauMotDePasse('');
    setMotDePasseChange(true);
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
          Adresse e-mail et mot de passe
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[2],
          paddingBottom: insets.bottom + theme.espace[6],
          gap: theme.espace[8],
        }}
      >
        <View style={{ gap: theme.espace[3] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Adresse e-mail
          </Text>
          <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
            {session?.email ?? ''}
          </Text>

          {adresseEnAttente ? (
            <View
              style={{
                gap: theme.espace[3],
                padding: theme.espace[4],
                borderRadius: theme.rayon.feuille,
                backgroundColor: theme.couleur.etat.alerteTeinte,
                borderWidth: 1,
                borderColor: theme.couleur.bordure.discrete,
              }}
            >
              <Text style={{ ...theme.texte.actionAccent, color: theme.couleur.etat.alerteEncre }}>
                Changement en attente de confirmation
              </Text>
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                Confirme le changement depuis les deux courriels envoyés à {session?.email ?? ''} et
                à {adresseEnAttente}. Tant que les deux ne sont pas confirmés, ton adresse ne change
                pas.
              </Text>
              <Bouton
                variante="secondaire"
                libelle="Renvoyer les courriels"
                onPress={renvoyerConfirmationAdresse}
                desactive={envoiAdresse}
              />
            </View>
          ) : (
            <>
              <Champ
                libelle="Nouvelle adresse"
                type="email"
                valeur={nouvelleAdresse}
                onChangeTexte={(valeur) => {
                  setNouvelleAdresse(valeur);
                  if (erreurAdresse) setErreurAdresse(undefined);
                }}
                onBlur={() => {
                  if (nouvelleAdresse !== '' && !adresseValide(nouvelleAdresse)) {
                    setErreurAdresse('Adresse e-mail incomplète.');
                  }
                }}
                messageErreur={erreurAdresse}
                desactive={envoiAdresse}
              />
              <Bouton
                libelle="Envoyer la confirmation"
                variante="primaire"
                onPress={envoyerConfirmationAdresse}
                desactive={nouvelleAdresse === '' || envoiAdresse}
              />
            </>
          )}
        </View>

        <View style={{ gap: theme.espace[3] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
            Mot de passe
          </Text>

          <Champ
            libelle="Mot de passe actuel"
            type="motDePasse"
            valeur={motDePasseActuel}
            onChangeTexte={(valeur) => {
              setMotDePasseActuel(valeur);
              if (erreurGlobaleMotDePasse) setErreurGlobaleMotDePasse(undefined);
            }}
            desactive={changementEnCours}
          />
          <Champ
            libelle="Nouveau mot de passe"
            type="motDePasse"
            valeur={nouveauMotDePasse}
            onChangeTexte={(valeur) => {
              setNouveauMotDePasse(valeur);
              if (erreurMotDePasse) setErreurMotDePasse(undefined);
            }}
            onBlur={() => {
              if (nouveauMotDePasse !== '') validerNouveauMotDePasse(nouveauMotDePasse);
            }}
            messageErreur={erreurMotDePasse}
            desactive={changementEnCours}
          />
          <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
            10 caractères minimum, 72 maximum.
          </Text>

          {erreurGlobaleMotDePasse ? (
            <View accessibilityLiveRegion="polite">
              <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
                {erreurGlobaleMotDePasse}
              </Text>
            </View>
          ) : null}

          {motDePasseChange ? (
            <View accessibilityLiveRegion="polite">
              <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.succesEncre }}>
                Mot de passe changé. Les autres appareils connectés ne pourront plus se reconnecter
                ; une session déjà ouverte ailleurs peut rester active jusqu’à une heure avant de se
                fermer.
              </Text>
            </View>
          ) : null}

          <Bouton
            libelle="Changer le mot de passe"
            variante="primaire"
            onPress={changerMotDePasse}
            desactive={motDePasseActuel === '' || !nouveauMotDePasseValide || changementEnCours}
          />
        </View>
      </ScrollView>
    </View>
  );
}
