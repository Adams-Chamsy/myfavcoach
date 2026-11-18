import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

type DernierExport = {
  demandeLe: string;
  pretLe: string | null;
  urlTelechargement: string | null;
  expireLe: string | null;
  tailleOctets: number | null;
} | null;

type EtatExport = 'aucun' | 'en_preparation' | 'pret';

// Prêt → Aucun export après 7 jours (fiche, "États (transitions)") : le fichier n'existe plus
// côté serveur, ce n'est pas seulement un lien qui casse — l'écran retombe donc sur l'état
// initial dès que expireLe est dépassé, jamais un état "Prêt" qui mentirait sur un lien mort.
function etatDe(export_: DernierExport): EtatExport {
  if (!export_ || !export_.pretLe) return export_ ? 'en_preparation' : 'aucun';
  if (
    !export_.urlTelechargement ||
    (export_.expireLe && Date.parse(export_.expireLe) <= Date.now())
  ) {
    return 'aucun';
  }
  return 'pret';
}

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

function formaterTaille(octets: number | null): string {
  if (octets == null) return '';
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function Export() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { port, profils } = useDonnees();

  const [chargement, setChargement] = useState(true);
  // Deux refus de nature différente (2 novembre 2026) : une panne du serveur, qui se réessaie, et
  // le quota d'un export par mois, une règle du produit, qui ne se réessaie pas.
  const [erreur, setErreur] = useState<'serveur' | 'quota_mensuel' | null>(null);
  const [export_, setExport] = useState<DernierExport>(null);
  const [demandeEnCours, setDemandeEnCours] = useState(false);

  useEffect(() => {
    let monte = true;
    port
      .lireDernierExport()
      .then((e) => {
        if (monte) {
          setExport(e);
          setChargement(false);
        }
      })
      .catch(() => {
        if (monte) {
          setErreur('serveur');
          setChargement(false);
        }
      });
    return () => {
      monte = false;
    };
  }, [port]);

  async function surDemander() {
    setErreur(null);
    setDemandeEnCours(true);
    try {
      const resultat = await port.demanderExportDonnees();
      if (!resultat.succes) {
        setErreur(resultat.code === 'export_trop_recent' ? 'quota_mensuel' : 'serveur');
        return;
      }
      setExport(await port.lireDernierExport());
    } catch {
      setErreur('serveur');
    } finally {
      setDemandeEnCours(false);
    }
  }

  const etiquettes = [
    'Compte et profil',
    ...(profils?.clientExiste
      ? ['Objectifs', 'Poids et mesures', 'Séances', 'Abonnements et factures', 'Coachs suivis']
      : []),
    ...(profils?.coachExiste ? ['Factures de commission et versements'] : []),
    'Tes autorisations',
  ];

  const etat = etatDe(export_);

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
          Tout ce qu’on a sur toi.
        </Text>
      </View>

      <DefilementEcran
        contentContainerStyle={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[4],
          gap: theme.espace[4],
        }}
      >
        {chargement ? (
          <Squelette forme="carte" />
        ) : (
          <>
            <View style={{ gap: theme.espace[2] }}>
              <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>
                Selon ton activité, le fichier peut contenir
              </Text>
              {etiquettes.map((etiquette) => (
                <Text
                  key={etiquette}
                  style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}
                >
                  · {etiquette}
                </Text>
              ))}
            </View>

            {profils?.clientExiste ? (
              <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                Ce fichier peut contenir ton poids et tes mesures. Le lien est personnel et expire
                au bout de 7 jours — ne le transfère à personne.
              </Text>
            ) : null}

            {etat === 'aucun' ? (
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
                Demande un export de tes données. Quand il sera prêt, tu trouveras ici un lien de
                téléchargement valable 7 jours.
              </Text>
            ) : (
              <CarteExport etat={etat} export_={export_} />
            )}

            {erreur === 'serveur' ? (
              <View accessibilityLiveRegion="polite">
                <EtatErreur
                  titre={textesRepliErreur.serveur.titre}
                  explication={textesRepliErreur.serveur.explication}
                  nombreEchecs={0}
                  onReessayer={() => void surDemander()}
                />
              </View>
            ) : null}
            {/* Textes validés le 2 novembre 2026 : une règle du produit, dite comme telle, sans
                « Réessayer » (un nouvel essai mènerait au même refus). */}
            {erreur === 'quota_mensuel' ? (
              <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
                <Text style={{ ...theme.texte.label, color: theme.couleur.texte.principal }}>
                  Tu as déjà demandé un export ce mois-ci
                </Text>
                <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                  Tu pourras en redemander un le mois prochain.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </DefilementEcran>

      <View
        style={{
          paddingHorizontal: theme.espace.gouttiere,
          paddingTop: theme.espace[3],
          paddingBottom: insets.bottom + theme.espace[3],
          borderTopWidth: 1,
          borderTopColor: theme.couleur.bordure.discrete,
        }}
      >
        <Bouton
          libelle={etat === 'aucun' ? 'Demander mon export' : 'Demander un nouvel export'}
          variante="secondaire"
          onPress={() => void surDemander()}
          desactive={chargement || demandeEnCours || etat === 'en_preparation'}
        />
      </View>
    </CanevasEcran>
  );
}

// Carte sombre FIXE (CLAUDE.md §5) : île, comme BlocEncre (src/fonctionnalites/compte/
// ecran-compte.tsx) — fond ET texte viennent toujours de themes.sombre, jamais de useTheme().
// <Badge> n'est PAS utilisé ici : il lit ses couleurs via useTheme() (contexte), qui suivrait le
// thème AMBIANT plutôt que cette île fixe — mêmes valeurs recopiées directement à la place.
function CarteExport({
  etat,
  export_,
}: {
  etat: Extract<EtatExport, 'en_preparation' | 'pret'>;
  export_: DernierExport;
}) {
  const theme = useTheme();
  const sombre = themes.sombre;
  const couleursBadge =
    etat === 'pret'
      ? { fond: sombre.etat.succesTeinte, texte: sombre.etat.succesEncre }
      : { fond: sombre.etat.alerteTeinte, texte: sombre.etat.alerteEncre };

  return (
    <View
      style={{
        gap: theme.espace[3],
        padding: theme.espace[4],
        borderRadius: theme.rayon.carte,
        backgroundColor: sombre.fond.canevas,
      }}
    >
      <View
        style={{
          alignSelf: 'flex-start',
          paddingVertical: theme.espace[1],
          paddingHorizontal: theme.espace[3],
          borderRadius: theme.rayon.badge,
          backgroundColor: couleursBadge.fond,
        }}
      >
        <Text style={{ ...theme.texte.petit, color: couleursBadge.texte, fontWeight: '700' }}>
          {etat === 'pret' ? 'PRÊT' : 'EN PRÉPARATION'}
        </Text>
      </View>

      {etat === 'pret' && export_?.pretLe ? (
        <>
          <Text style={{ ...theme.texte.corps, color: sombre.texte.surSombre }}>
            {formaterTaille(export_.tailleOctets)} · JSON
          </Text>
          <Text style={{ ...theme.texte.petit, color: sombre.texte.secondaire }}>
            Demandé le {formaterDate(export_.demandeLe)}
          </Text>
          {export_.expireLe ? (
            <Text style={{ ...theme.texte.petit, color: sombre.texte.secondaire }}>
              Disponible jusqu’au {formaterDate(export_.expireLe)}, puis supprimé.
            </Text>
          ) : null}
          {/* Pressable brut, jamais <Bouton> : ce dernier lit ses couleurs via useTheme()
              (contexte), qui suivrait le thème AMBIANT plutôt que cette île fixe — mêmes
              tokens sombre recopiés directement, comme le reste de cette carte. */}
          <Pressable
            onPress={() => {
              if (export_.urlTelechargement) void Linking.openURL(export_.urlTelechargement);
            }}
            accessibilityRole="button"
            accessibilityLabel="Télécharger"
            style={{
              alignSelf: 'flex-start',
              minHeight: theme.taille.tapMin,
              paddingHorizontal: theme.espace[4],
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: sombre.bordure.marquee,
              borderRadius: theme.rayon.pilule,
            }}
          >
            <Text style={{ ...theme.texte.actionAccent, color: sombre.texte.surSombre }}>
              Télécharger
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={{ ...theme.texte.petit, color: sombre.texte.secondaire }}>
          Demandé le {export_ ? formaterDate(export_.demandeLe) : ''}. Reviens plus tard : aucun
          sondage automatique, rouvre cet écran pour vérifier.
        </Text>
      )}
    </View>
  );
}
