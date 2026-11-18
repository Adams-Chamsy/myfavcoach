import { Text, View } from 'react-native';

import { dateLongue } from '@/fonctionnalites/factures/format';
import type { SemaineSuivi } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

export function SemainesSuivi({ semaines }: { semaines: SemaineSuivi[] }) {
  const theme = useTheme();
  const hauteur = theme.espace[12];
  const maximum = Math.max(1, ...semaines.map((s) => Math.max(s.faites, s.prevues)));
  const texte = { ...theme.texte.legende, color: theme.couleur.texte.principal };
  const resume = semaines
    .map((s) => `${dateLongue(s.lundi)}, ${s.faites} sur ${s.prevues}`)
    .join('. ');
  return (
    <View style={{ gap: theme.espace[2] }}>
      <Text
        accessibilityRole="header"
        style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}
      >
        Séances par semaine
      </Text>
      <View
        accessible
        accessibilityLabel={resume}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[1] }}
      >
        {semaines.map((s) => (
          <View
            key={s.lundi}
            style={{
              flexGrow: 1,
              minWidth: theme.taille.tapMin,
              alignItems: 'center',
              gap: theme.espace[1],
            }}
          >
            <Text style={texte}>
              {s.faites}/{s.prevues}
            </Text>
            <View
              style={{
                width: '100%',
                height: hauteur,
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '58%',
                  height: Math.max(
                    theme.taille.bordureFine,
                    (hauteur * Math.max(s.faites, s.prevues)) / maximum,
                  ),
                  backgroundColor: theme.couleur.bordure.discrete,
                  justifyContent: 'flex-end',
                }}
              >
                <View
                  style={{
                    height: (hauteur * s.faites) / maximum,
                    backgroundColor: theme.couleur.marque.primaire,
                  }}
                />
              </View>
            </View>
            <Text style={texte}>
              {s.lundi.slice(8, 10)}/{s.lundi.slice(5, 7)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
