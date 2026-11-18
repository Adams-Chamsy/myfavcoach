import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { useParcoursVisiteur } from '@/fonctionnalites/accueil/fournisseur-parcours-visiteur';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useTheme } from '@/theme/fournisseur';

export function BoutonSuivreCoach({
  coachId,
  clientPret,
  chargement,
}: {
  coachId: string;
  clientPret: boolean;
  chargement: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { port } = useDonnees();
  const { session } = useSession();
  const { retourCoach, retenirCoach, oublierRetour } = useParcoursVisiteur();
  const aReprendre = retourCoach?.coachId === coachId && retourCoach.intention === 'suivre';
  const [suivi, setSuivi] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState(false);
  const [ecriture, setEcriture] = useState(false);
  const [tentative, setTentative] = useState(0);
  const enCours = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!clientPret || chargement) return;
      let actif = true;
      const lecture = aReprendre
        ? port.definirSuiviCoach(coachId, true).then(() => true)
        : port.lireMesCoachsSuivis().then((coachs) => coachs.some(({ id }) => id === coachId));
      void lecture
        .then((estSuivi) => {
          if (!actif) return;
          setSuivi(estSuivi);
          setErreur(false);
          if (aReprendre) oublierRetour();
        })
        .catch(() => {
          if (actif) setErreur(true);
        });
      return () => {
        actif = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Réessayer relance le suivi pendant que le profil est visible.
    }, [aReprendre, chargement, clientPret, coachId, oublierRetour, port, tentative]),
  );

  async function modifier() {
    if (!clientPret) {
      retenirCoach(coachId, 'suivre');
      router.push(session?.emailVerifie ? '/' : '/(public)/connexion');
      return;
    }
    if (suivi === null || (aReprendre && erreur)) {
      setErreur(false);
      setTentative((n) => n + 1);
      return;
    }
    if (enCours.current) return;
    enCours.current = true;
    setEcriture(true);
    setErreur(false);
    try {
      await port.definirSuiviCoach(coachId, !suivi);
      setSuivi(!suivi);
    } catch {
      setErreur(true);
    } finally {
      enCours.current = false;
      setEcriture(false);
    }
  }

  return (
    <>
      <Bouton
        libelle={erreur && suivi === null ? 'Réessayer le suivi' : suivi ? 'Suivi' : 'Suivre'}
        accessibilityLabel={suivi ? 'Ne plus suivre ce coach' : undefined}
        variante="secondaire"
        desactive={chargement || ecriture || (clientPret && suivi === null && !erreur)}
        onPress={modifier}
      />
      {erreur ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.couleur.etat.erreurEncre }}>
          Impossible de mettre à jour le suivi. Réessaie.
        </Text>
      ) : null}
    </>
  );
}
