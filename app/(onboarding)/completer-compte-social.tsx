import { type Href, Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { Champ } from '@/composants/champ';
import { estMajeur, formatDateISO } from '@/fonctionnalites/identite/age';
import { VERSION_CGU_ACCEPTEE } from '@/fonctionnalites/identite/documents-legaux';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useTheme } from '@/theme/fournisseur';

function lireDate(saisie: string): Date | null {
  const morceaux = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(saisie.trim());
  if (!morceaux) return null;
  const [, jour, mois, annee] = morceaux.map(Number);
  const date = new Date(annee!, mois! - 1, jour!);
  return date.getFullYear() === annee && date.getMonth() === mois! - 1 && date.getDate() === jour
    ? date
    : null;
}

export default function CompleterCompteSocial() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { port: auth, chargement: chargementSession } = useSession();
  const { port, profils, chargement, erreurLecture, relire } = useDonnees();
  const [date, setDate] = useState('');
  const [accepte, setAccepte] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [enCours, setEnCours] = useState(false);
  const operation = useRef(false);

  if (chargementSession || chargement) return null;
  if (!profils?.compteACompleter && !erreurLecture) return <Redirect href="/" />;

  async function completer() {
    if (!accepte || operation.current) return;
    const naissance = lireDate(date);
    if (!naissance) {
      setMessage('Saisis une date valide au format JJ/MM/AAAA.');
      return;
    }
    if (!estMajeur(naissance)) {
      setMessage('My Fav Coach est réservé aux majeurs.');
      return;
    }
    operation.current = true;
    setEnCours(true);
    setMessage(undefined);
    try {
      const resultat = await port.completerCompteSocial(
        formatDateISO(naissance),
        VERSION_CGU_ACCEPTEE,
      );
      if (resultat.succes) await relire();
      else if (resultat.erreur === 'age_insuffisant')
        setMessage('My Fav Coach est réservé aux majeurs.');
      else setMessage('Impossible d’enregistrer pour le moment. Réessaie.');
    } catch {
      setMessage('Impossible d’enregistrer pour le moment. Réessaie.');
    } finally {
      operation.current = false;
      setEnCours(false);
    }
  }

  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <DefilementEcran
        contentContainerStyle={{
          paddingTop: insets.top + theme.espace[6],
          paddingBottom: insets.bottom + theme.espace[6],
          paddingHorizontal: theme.espace.gouttiere,
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          Finalise ton compte
        </Text>
        {erreurLecture ? (
          <Bouton libelle="Réessayer" variante="primaire" onPress={() => void relire()} />
        ) : (
          <>
            <Champ
              libelle="Date de naissance (JJ/MM/AAAA)"
              valeur={date}
              onChangeTexte={setDate}
              desactive={enCours}
            />
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/(public)/documents/cgu' as Href)}
              style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
            >
              <Text style={{ ...theme.texte.corps, color: theme.couleur.marque.primaire }}>
                Lire les conditions d’utilisation
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepte, disabled: enCours }}
              disabled={enCours}
              onPress={() => setAccepte(!accepte)}
              style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}>
                <Text
                  accessible={false}
                  style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}
                >
                  {accepte ? '☑' : '☐'}
                </Text>
                <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                  J’accepte les conditions d’utilisation
                </Text>
              </View>
            </Pressable>
            {message ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}
              >
                {message}
              </Text>
            ) : null}
            <Bouton
              libelle="Continuer"
              variante="primaire"
              desactive={!accepte || !date.trim() || enCours}
              onPress={() => void completer()}
            />
          </>
        )}
        <Bouton
          libelle="Se déconnecter"
          variante="secondaire"
          desactive={enCours}
          onPress={() => void auth.deconnecter()}
        />
      </DefilementEcran>
    </CanevasEcran>
  );
}
