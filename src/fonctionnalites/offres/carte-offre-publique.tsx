import { Text, View } from 'react-native';

import { Badge } from '@/composants/badge';
import { Carte } from '@/composants/carte';
import { Icone } from '@/composants/icones';
import type { Offre } from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

export function montantOffreEnEuros(centimes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: centimes % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(centimes / 100);
}

export function CarteOffrePublique({
  titre,
  description,
  prixCentimes,
  benefices,
  engagementHumain,
  estMiseEnAvant,
}: Pick<Offre, 'titre' | 'description' | 'benefices' | 'engagementHumain' | 'estMiseEnAvant'> & {
  prixCentimes: number | null;
}) {
  const theme = useTheme();
  const texte = { ...theme.texte.petit, color: theme.couleur.texte.secondaire };

  return (
    <Carte>
      <View style={{ padding: theme.espace[6], gap: theme.espace[4] }}>
        {estMiseEnAvant ? <Badge statut="accent" libelle="LE PLUS CHOISI" /> : null}
        <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
          {titre || 'Offre sans titre'}
        </Text>
        {prixCentimes === null ? (
          <Text style={texte}>Prix mensuel à renseigner</Text>
        ) : (
          <Text style={{ ...theme.texte.display, color: theme.couleur.marque.primaire }}>
            {montantOffreEnEuros(prixCentimes)} €<Text style={texte}> / mois</Text>
          </Text>
        )}
        {description ? <Text style={texte}>{description}</Text> : null}
        {benefices.map((benefice, index) => (
          <View
            key={`${index}-${benefice}`}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.espace[3] }}
          >
            <Icone nom="valide" couleur={theme.couleur.marque.primaire} />
            <Text style={[texte, { flex: 1 }]}>{benefice}</Text>
          </View>
        ))}
        {engagementHumain.length ? (
          <View style={{ gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}>
              Accompagnement du coach
            </Text>
            {engagementHumain.map((engagement) => (
              <Text key={engagement} style={texte}>
                {engagement}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Carte>
  );
}
