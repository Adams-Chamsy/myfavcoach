import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { Carte } from '@/composants/carte';
import { Onglets } from '@/composants/onglets';
import { useTheme } from '@/theme/fournisseur';
import { VitrineVideoDemo } from './vitrine-video-demo';

type Vue = 'coach' | 'moderation' | 'visiteur';
type Statut = 'sans_clip' | 'brouillon' | 'en_examen' | 'refusee' | 'publiee' | 'retiree';

const VUES: { valeur: Vue; libelle: string }[] = [
  { valeur: 'coach', libelle: 'Coach' },
  { valeur: 'moderation', libelle: 'Modération' },
  { valeur: 'visiteur', libelle: 'Visiteur' },
];

const LIBELLES: Record<Statut, string> = {
  sans_clip: 'Aucun clip choisi',
  brouillon: 'Brouillon',
  en_examen: 'En attente de validation',
  refusee: 'Refusée',
  publiee: 'Publiée',
  retiree: 'Retirée',
};

export function ModerationVideoDemo() {
  const theme = useTheme();
  const [vue, setVue] = useState<Vue>('coach');
  const [statut, setStatut] = useState<Statut>('sans_clip');
  const [attestation, setAttestation] = useState(false);
  const titre = { ...theme.texte.titre3, color: theme.couleur.texte.principal };
  const detail = { ...theme.texte.corps, color: theme.couleur.texte.secondaire };

  return (
    <Carte>
      <View style={{ padding: theme.espace[4], gap: theme.espace[4] }}>
        <Onglets options={VUES} valeurActive={vue} onChangement={setVue} />
        {vue === 'visiteur' ? (
          statut === 'publiee' ? (
            <VitrineVideoDemo />
          ) : (
            <Text style={detail}>Aucune vidéo visible sur le profil public.</Text>
          )
        ) : (
          <>
            <Text accessibilityLiveRegion="polite" style={titre}>
              {LIBELLES[statut]}
            </Text>
            {vue === 'coach' ? (
              <>
                {statut === 'sans_clip' || statut === 'refusee' || statut === 'retiree' ? (
                  <>
                    {statut === 'refusee' ? (
                      <Text style={detail}>
                        Motif du refus : vérifie l’autorisation des personnes filmées.
                      </Text>
                    ) : null}
                    <Bouton
                      libelle="Choisir le clip de démonstration"
                      variante="secondaire"
                      onPress={() => {
                        setAttestation(false);
                        setStatut('brouillon');
                      }}
                    />
                  </>
                ) : (
                  <VitrineVideoDemo />
                )}
                {statut === 'brouillon' ? (
                  <>
                    <View
                      style={{ flexDirection: 'row', gap: theme.espace[3], alignItems: 'center' }}
                    >
                      <Text style={[detail, { flex: 1 }]}>
                        Je confirme avoir l’accord écrit de toute autre personne identifiable.
                      </Text>
                      <Switch
                        accessibilityLabel="Confirmer les autorisations des personnes filmées"
                        value={attestation}
                        onValueChange={setAttestation}
                      />
                    </View>
                    <Bouton
                      libelle="Soumettre à validation"
                      variante="primaire"
                      desactive={!attestation}
                      onPress={() => setStatut('en_examen')}
                    />
                  </>
                ) : null}
              </>
            ) : statut === 'en_examen' || statut === 'publiee' ? (
              <>
                <VitrineVideoDemo />
                {statut === 'en_examen' ? (
                  <>
                    <Bouton
                      libelle="Valider la publication"
                      variante="primaire"
                      onPress={() => setStatut('publiee')}
                    />
                    <Bouton
                      libelle="Refuser pour droit à l’image"
                      variante="secondaire"
                      onPress={() => setStatut('refusee')}
                    />
                  </>
                ) : (
                  <Bouton
                    libelle="Retirer du profil public"
                    variante="secondaire"
                    onPress={() => setStatut('retiree')}
                  />
                )}
              </>
            ) : null}
          </>
        )}
      </View>
    </Carte>
  );
}
