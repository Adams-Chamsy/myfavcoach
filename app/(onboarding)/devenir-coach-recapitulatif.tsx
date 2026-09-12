import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { Icone } from '@/composants/icones';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';

// L2-07 — étape 4/4. Aucune écriture ici (fiche, Règles) : un point d'arrivée, pas un
// formulaire. Le récapitulatif reprend la checklist de l'écran 19 (L2-11), pas un contenu
// distinct (fiche, "Ce qui a été inventé").
export default function DevenirCoachRecapitulatif() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lireInformations, lirePiecesDeposees } = useDonnees().port;

  const [profilFait, setProfilFait] = useState(false);
  const [pieceIdentiteDeposee, setPieceIdentiteDeposee] = useState(false);

  useEffect(() => {
    let monte = true;
    void Promise.all([lireInformations(), lirePiecesDeposees()]).then(([info, pieces]) => {
      if (!monte) return;
      setProfilFait(info.profil === 'coach' && !!info.titreCourt && !!info.bio);
      setPieceIdentiteDeposee(pieces.some((p) => p.type === 'identite'));
    });
    return () => {
      monte = false;
    };
  }, [lireInformations, lirePiecesDeposees]);

  const lignes: { libelle: string; fait: boolean }[] = [
    { libelle: 'Photo et bio', fait: profilFait },
    { libelle: 'Pièce d’identité déposée', fait: pieceIdentiteDeposee },
    { libelle: 'Première offre créée', fait: false },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: insets.top + theme.espace[6],
          paddingBottom: theme.espace[6],
          gap: theme.espace[4],
        }}
      >
        <Text style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}>
          C’est parti.
        </Text>
        <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
          Ton profil est en préparation. Termine-le pendant que ton dossier est examiné.
        </Text>

        <View style={{ gap: theme.espace[3] }}>
          {lignes.map((ligne) => (
            <View
              key={ligne.libelle}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}
            >
              <Icone
                nom={ligne.fait ? 'valide' : 'information'}
                couleur={ligne.fait ? theme.couleur.etat.succesEncre : theme.couleur.texte.attenue}
              />
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
                {ligne.libelle}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
        }}
      >
        <Bouton
          libelle="Aller à mon espace coach"
          variante="primaire"
          onPress={() => router.replace('/(coach)/pilotage')}
        />
      </View>
    </View>
  );
}
