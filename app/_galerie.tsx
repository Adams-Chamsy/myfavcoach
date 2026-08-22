import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';

import { Avatar, type TailleAvatar } from '@/composants/avatar';
import { BarreNavigation } from '@/composants/barre-navigation';
import { Badge, type StatutBadge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { BoutonIcone } from '@/composants/bouton-icone';
import { Carte } from '@/composants/carte';
import { Champ } from '@/composants/champ';
import { Chip } from '@/composants/chip';
import { EmplacementImage } from '@/composants/emplacement-image';
import { EtatChargement } from '@/composants/etats/etat-chargement';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { EtatVide } from '@/composants/etats/etat-vide';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone, icones, type NomIcone } from '@/composants/icones';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { Modale } from '@/composants/modale';
import { Onglets } from '@/composants/onglets';
import { Progression, type EtatSegment } from '@/composants/progression';
import { Squelette, type FormeSquelette } from '@/composants/squelette';
import {
  clientsDemonstration,
  coachsDemonstration,
  offresDemonstration,
  programmesDemonstration,
  seancesDemonstration,
} from '@/fixtures/demonstration';
import {
  FournisseurMouvementReduit,
  FournisseurTheme,
  useTheme,
  type ThemeResolu,
} from '@/theme/fournisseur';
import { font } from '@/theme/tokens';
import type { StyleOmbre } from '@/theme/types';

// Galerie de developpement (docs/ecrans/L0-00-galerie-systeme.md). Montee uniquement en
// developpement : la garde ci-dessous est une securite d'affichage, le mecanisme qui retire
// vraiment la route du bundle de production est resolver.blockList dans metro.config.js
// (verifie par `npx expo export -p web` + `grep -r "_galerie" dist/`, critere d'acceptation 2).
export default function Galerie() {
  const [themeClair, setThemeClair] = useState(true);
  const [mouvementReduitForce, setMouvementReduitForce] = useState(false);

  if (!__DEV__) return null;

  return (
    <FournisseurTheme themeForce={themeClair ? 'clair' : 'sombre'}>
      <FournisseurMouvementReduit force={mouvementReduitForce}>
        <Corps
          themeClair={themeClair}
          onChangeThemeClair={setThemeClair}
          mouvementReduitForce={mouvementReduitForce}
          onChangeMouvementReduitForce={setMouvementReduitForce}
        />
      </FournisseurMouvementReduit>
    </FournisseurTheme>
  );
}

type ProprietesCorps = {
  themeClair: boolean;
  onChangeThemeClair: (valeur: boolean) => void;
  mouvementReduitForce: boolean;
  onChangeMouvementReduitForce: (valeur: boolean) => void;
};

function Corps({
  themeClair,
  onChangeThemeClair,
  mouvementReduitForce,
  onChangeMouvementReduitForce,
}: ProprietesCorps) {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.couleur.fond.canevas }}
      contentContainerStyle={{ padding: theme.espace[6], gap: theme.espace[6] }}
    >
      <SectionCouleurs />
      <SectionTypographie />
      <SectionEspacesRayonsOmbres />
      <SectionBoutons />
      <SectionChamps />
      <SectionChipsOngletsProgression />
      <SectionBadgesAvatars />
      <SectionCartes />
      <SectionNavigation />
      <SectionFeuilleEtModale />
      <SectionEtats />
      <SectionIcones />
      <PiedGalerie
        themeClair={themeClair}
        onChangeThemeClair={onChangeThemeClair}
        mouvementReduitForce={mouvementReduitForce}
        onChangeMouvementReduitForce={onChangeMouvementReduitForce}
      />
    </ScrollView>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.couleur.fond.surface,
        borderWidth: 1,
        borderColor: theme.couleur.bordure.discrete,
        borderRadius: theme.rayon.feuille,
        padding: theme.espace[6],
        gap: theme.espace[4],
      }}
    >
      {/* Titre de section en texte.label, litteralement demande par la fiche (pas titre2). */}
      <Text style={{ ...theme.texte.label, color: theme.couleur.texte.secondaire }}>{titre}</Text>
      {children}
    </View>
  );
}

function SousTitre({ texte }: { texte: string }) {
  const theme = useTheme();
  return <Text style={{ ...theme.texte.label, color: theme.couleur.texte.attenue }}>{texte}</Text>;
}

// ---------------------------------------------------------------------------------------------
// 1 · Couleurs
// ---------------------------------------------------------------------------------------------

function SectionCouleurs() {
  const theme = useTheme();
  const groupes = Object.entries(theme.couleur) as [string, Record<string, string>][];

  return (
    <Section titre="1 · Couleurs">
      {groupes.map(([nomGroupe, valeurs]) => (
        <View key={nomGroupe} style={{ gap: theme.espace[2] }}>
          <SousTitre texte={nomGroupe} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[3] }}>
            {Object.entries(valeurs).map(([nom, hex]) => (
              <View key={nom} style={{ alignItems: 'center', gap: theme.espace[1] }}>
                <View
                  style={{
                    width: theme.taille.avatarMd,
                    height: theme.taille.avatarMd,
                    borderRadius: theme.rayon.pilule,
                    backgroundColor: hex,
                    borderWidth: 1,
                    borderColor: theme.couleur.bordure.discrete,
                  }}
                />
                <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.principal }}>
                  {nom}
                </Text>
                <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
                  {hex}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 2 · Typographie
// ---------------------------------------------------------------------------------------------

function SectionTypographie() {
  const theme = useTheme();
  const styles = Object.entries(theme.texte);

  return (
    <Section titre="2 · Typographie">
      {styles.map(([nom, style]) => (
        <View key={nom} style={{ gap: theme.espace[1] }}>
          <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
            texte.{nom}
          </Text>
          <Text style={{ ...style, color: theme.couleur.texte.principal }}>
            {"Texte d'exemple en français"}
          </Text>
        </View>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 3 · Espaces, rayons, ombres
// ---------------------------------------------------------------------------------------------

// Meme conversion que la fonction privee styleOmbre de src/composants/carte.tsx : dupliquee ici
// volontairement, Carte ne permet pas de choisir un niveau d'ombre (elle fixe theme.ombre[1]
// par design, docs/design-system.md §6) et cette section doit montrer les 3 niveaux.
function styleOmbreApercu(ombre: StyleOmbre) {
  const composantes = ombre.color.match(/[\d.]+/g);
  const [r, g, b, a] = (composantes ?? ['0', '0', '0', '1']).map(Number);
  return {
    shadowColor: `rgb(${r}, ${g}, ${b})`,
    shadowOpacity: a,
    shadowOffset: { width: ombre.x, height: ombre.y },
    shadowRadius: ombre.blur,
    elevation: Math.round(ombre.blur / 2),
  };
}

function SectionEspacesRayonsOmbres() {
  const theme = useTheme();
  // "La suite 4 → 64" : uniquement la progression numerotee, pas gouttiere/gouttiereTablette
  // qui sont des tokens a part (docs/ecrans/L0-00-galerie-systeme.md §3).
  const espacesProgression = Object.entries(theme.espace).filter(([nom]) => /^\d+$/.test(nom));
  const rayons = Object.entries(theme.rayon);
  const ombres = Object.entries(theme.ombre);

  return (
    <Section titre="3 · Espaces, rayons, ombres">
      <SousTitre texte="Espaces" />
      <View style={{ gap: theme.espace[2] }}>
        {espacesProgression.map(([nom, valeur]) => (
          <View
            key={nom}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}
          >
            <Text
              style={{
                ...theme.texte.legende,
                color: theme.couleur.texte.attenue,
                width: theme.taille.avatarSm,
              }}
            >
              espace.{nom}
            </Text>
            <View
              style={{
                height: theme.espace[3],
                width: valeur,
                borderRadius: theme.rayon.pilule,
                backgroundColor: theme.couleur.marque.primaire,
              }}
            />
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              {valeur}
            </Text>
          </View>
        ))}
      </View>

      <SousTitre texte="Rayons" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[4] }}>
        {rayons.map(([nom, valeur]) => (
          <View key={nom} style={{ alignItems: 'center', gap: theme.espace[1] }}>
            <View
              style={{
                width: theme.taille.avatarLg,
                height: theme.taille.avatarLg,
                borderRadius: valeur,
                backgroundColor: theme.couleur.marque.primaireTeinte,
                borderWidth: 1,
                borderColor: theme.couleur.marque.primaireTeinte2,
              }}
            />
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.principal }}>
              {nom}
            </Text>
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              {valeur}
            </Text>
          </View>
        ))}
      </View>

      <SousTitre texte="Ombres" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[6] }}>
        {ombres.map(([nom, ombre]) => (
          <View key={nom} style={{ alignItems: 'center', gap: theme.espace[2] }}>
            <View
              style={{
                width: theme.taille.avatarXl,
                height: theme.taille.avatarXl,
                borderRadius: theme.rayon.carte,
                backgroundColor: theme.couleur.fond.surface,
                ...styleOmbreApercu(ombre),
              }}
            />
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              ombre.{nom}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 4 · Boutons
// ---------------------------------------------------------------------------------------------

const VARIANTES_BOUTON = ['primaire', 'secondaire', 'discret', 'accent', 'destructeur'] as const;
const ETATS_BOUTON = ['défaut', 'pressé', 'désactivé', 'focus'] as const;

function SectionBoutons() {
  const theme = useTheme();

  return (
    <Section titre="4 · Boutons">
      {VARIANTES_BOUTON.map((variante) => (
        <View key={variante} style={{ gap: theme.espace[2] }}>
          <SousTitre texte={variante} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[3] }}>
            {ETATS_BOUTON.map((etat) => (
              <View key={etat} style={{ alignItems: 'center', gap: theme.espace[1] }}>
                <Bouton
                  libelle={etat}
                  variante={variante}
                  onPress={() => {}}
                  desactive={etat === 'désactivé'}
                  previsualiserEtat={
                    etat === 'pressé' ? 'presse' : etat === 'focus' ? 'focus' : undefined
                  }
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      <SousTitre texte="BoutonIcone" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[3] }}>
        {ETATS_BOUTON.map((etat) => (
          <BoutonIcone
            key={etat}
            nom="favori"
            accessibilityLabel={`Favori, état ${etat}`}
            onPress={() => {}}
            desactive={etat === 'désactivé'}
            previsualiserEtat={
              etat === 'pressé' ? 'presse' : etat === 'focus' ? 'focus' : undefined
            }
          />
        ))}
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 5 · Champs
// ---------------------------------------------------------------------------------------------

function SectionChamps() {
  const theme = useTheme();
  const [valeurNormal, setValeurNormal] = useState('');
  const [valeurFocus, setValeurFocus] = useState('');
  const [valeurErreur, setValeurErreur] = useState('mo@');

  return (
    <Section titre="5 · Champs">
      <Champ
        libelle="Normal"
        valeur={valeurNormal}
        onChangeTexte={setValeurNormal}
        placeholder="Texte d'exemple"
      />
      <View style={{ gap: theme.espace[1] }}>
        <Champ
          libelle="Focus (touche le champ)"
          valeur={valeurFocus}
          onChangeTexte={setValeurFocus}
        />
        <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
          État transitoire, non pilotable par prop : touche le champ pour le voir.
        </Text>
      </View>
      <Champ
        libelle="Erreur"
        valeur={valeurErreur}
        onChangeTexte={setValeurErreur}
        messageErreur="Adresse e-mail incomplète"
      />
      <Champ libelle="Désactivé" valeur="Non modifiable" onChangeTexte={() => {}} desactive />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 6 · Chips, onglets, progression
// ---------------------------------------------------------------------------------------------

type OngletGalerie = 'client' | 'coach';

function SectionChipsOngletsProgression() {
  const theme = useTheme();
  const [filtreSelectionne, setFiltreSelectionne] = useState(false);
  const [chipRetirableVisible, setChipRetirableVisible] = useState(true);
  const [onglet, setOnglet] = useState<OngletGalerie>('client');
  const [valeurBarre, setValeurBarre] = useState(35);

  // Camille Dupré, semaine 3 · 3/5 faites (src/fixtures/demonstration.ts, docs/domaine.md §6) :
  // meme lecture que le bandeau de progression de l'ecran 01
  // (maquettes/MyFavCoach-System_dc.html) — 3 séances atteintes, la suivante en cours
  // aujourd'hui, le reste de la semaine encore à venir.
  const camille = clientsDemonstration.find((c) => c.prenom === 'Camille')!;
  const segments: EtatSegment[] = Array.from(
    { length: camille.seancesProgrammeesSemaine ?? 0 },
    (_, index) =>
      index < (camille.seancesFaitesSemaine ?? 0)
        ? 'atteint'
        : index === camille.seancesFaitesSemaine
          ? 'actuel'
          : 'reste',
  );

  return (
    <Section titre="6 · Chips, onglets, progression">
      <SousTitre texte="Chips" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
        <Chip libelle="Nutrition" />
        <Chip
          libelle="En visio"
          variante="filtre"
          selectionne={filtreSelectionne}
          onPress={() => setFiltreSelectionne((v) => !v)}
        />
        {chipRetirableVisible ? (
          <Chip
            libelle="Cybersécurité"
            variante="filtreRetirable"
            selectionne
            onPress={() => {}}
            onRetirer={() => setChipRetirableVisible(false)}
            accessibilityLabelRetirer="Retirer le filtre Cybersécurité"
          />
        ) : (
          <Bouton
            variante="discret"
            libelle="Remettre le chip retirable"
            onPress={() => setChipRetirableVisible(true)}
          />
        )}
      </View>

      <SousTitre texte="Onglets" />
      <Onglets<OngletGalerie>
        options={[
          { valeur: 'client', libelle: 'Espace client' },
          { valeur: 'coach', libelle: 'Espace coach' },
        ]}
        valeurActive={onglet}
        onChangement={setOnglet}
      />

      <SousTitre texte="Progression" />
      <View style={{ gap: theme.espace[2] }}>
        <Progression
          variante="barre"
          valeur={valeurBarre}
          accessibilityLabel={`Progression à ${valeurBarre} pour cent`}
        />
        <Bouton
          variante="discret"
          libelle="Faire varier la valeur (anime au changement, pas au montage)"
          onPress={() => setValeurBarre((v) => (v >= 90 ? 10 : v + 20))}
        />
      </View>
      <Progression
        variante="segments"
        segments={segments}
        accessibilityLabel={`Semaine ${camille.semaineAbonnement}, ${camille.seancesFaitesSemaine} séances sur ${camille.seancesProgrammeesSemaine} faites`}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 7 · Badges, avatars
// ---------------------------------------------------------------------------------------------

// Libelles repris tels quels de docs/design-system.md §2 (les seuls exemples explicitement
// donnes) et de leurs couleurs verifiees dans maquettes/MyFavCoach-Coach_dc.html.
const BADGES_EXEMPLE: { statut: StatutBadge; libelle: string }[] = [
  { statut: 'succes', libelle: 'À JOUR' },
  { statut: 'alerte', libelle: 'PAIEMENT KO' },
  { statut: 'erreur', libelle: 'INACTIVE 12 J' },
  { statut: 'accent', libelle: 'NOUVEAU' },
  { statut: 'neutre', libelle: 'Neutre' },
];

const TAILLES_AVATAR: TailleAvatar[] = ['xs', 'sm', 'md', 'lg', 'xl'];

function SectionBadgesAvatars() {
  const theme = useTheme();
  const yannick = coachsDemonstration.find((c) => c.prenom === 'Yannick')!;
  const nomYannick = `${yannick.prenom} ${yannick.nom}`;
  const camille = clientsDemonstration.find((c) => c.prenom === 'Camille')!;
  const nomCamille = `${camille.prenom} ${camille.nom}`;

  return (
    <Section titre="7 · Badges, avatars">
      <SousTitre texte="Badges" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
        {BADGES_EXEMPLE.map(({ statut, libelle }) => (
          <Badge key={statut} statut={statut} libelle={libelle} />
        ))}
      </View>

      <SousTitre texte="Avatars" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.espace[4] }}>
        {TAILLES_AVATAR.map((taille) => (
          <View key={taille} style={{ alignItems: 'center', gap: theme.espace[1] }}>
            <Avatar nom={nomYannick} taille={taille} />
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              {taille}
            </Text>
          </View>
        ))}
        <View style={{ alignItems: 'center', gap: theme.espace[1] }}>
          <Avatar
            nom={nomCamille}
            taille="lg"
            pastille={{ couleur: theme.couleur.etat.succes, accessibilityLabel: 'Actif' }}
          />
          <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
            avec pastille
          </Text>
        </View>
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 8 · Cartes
// ---------------------------------------------------------------------------------------------

function SectionCartes() {
  const theme = useTheme();
  // Nadia Belkacem : carte de reference exacte de maquettes/MyFavCoach-System_dc.html, bloc
  // "Cartes" (docs/ecrans/L0-00-galerie-systeme.md pointe explicitement vers ce bloc).
  const coach = coachsDemonstration.find((c) => c.prenom === 'Nadia')!;
  const nomCoach = `${coach.prenom} ${coach.nom}`;
  const offre = offresDemonstration.find((o) => o.coach === nomCoach);
  const noteAffichee = coach.note ? coach.note.toFixed(1).replace('.', ',') : null;
  const prixAffiche =
    offre?.prixMensuelCentimes != null ? Math.round(offre.prixMensuelCentimes / 100) : null;
  const seance = seancesDemonstration[0];
  const programme = programmesDemonstration[0];
  const progressionProgramme = Math.round((programme.moduleActuel / programme.nombreModules) * 100);

  return (
    <Section titre="8 · Cartes">
      <SousTitre texte="Carte coach" />
      <Carte>
        <View>
          <EmplacementImage nom={nomCoach} ratio="paysage4x3" />
          <View style={{ position: 'absolute', top: theme.espace[3], left: theme.espace[3] }}>
            <Badge statut="neutre" libelle={coach.discipline} />
          </View>
        </View>
        <View style={{ padding: theme.espace[4], gap: theme.espace[1] }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
              {nomCoach}
            </Text>
            {noteAffichee ? (
              <Text
                style={{
                  ...theme.texte.petit,
                  fontFamily: font.uiBold,
                  color: theme.couleur.texte.principal,
                }}
              >
                {noteAffichee}
              </Text>
            ) : (
              <Badge statut="accent" libelle="Nouveau" />
            )}
          </View>
          {offre ? (
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              {offre.titre}
              {offre.offreDureeSemaines ? ` · ${offre.offreDureeSemaines} semaines` : ''}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: theme.espace[1],
            }}
          >
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              {offre?.nombreAbonnes ? `${offre.nombreAbonnes} abonnés` : ''}
            </Text>
            {prixAffiche != null ? (
              <Text
                style={{
                  ...theme.texte.petit,
                  fontFamily: font.uiBold,
                  color: theme.couleur.texte.principal,
                }}
              >
                {prixAffiche} €
                <Text
                  style={{
                    ...theme.texte.legende,
                    fontFamily: font.uiSemibold,
                    color: theme.couleur.texte.attenue,
                  }}
                >
                  {' '}
                  /mois
                </Text>
              </Text>
            ) : null}
          </View>
        </View>
      </Carte>

      <SousTitre texte="Carte séance" />
      <Carte>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.espace[3],
            padding: theme.espace[4],
          }}
        >
          <View
            style={{
              width: theme.taille.avatarLg,
              height: theme.taille.avatarLg,
              borderRadius: theme.rayon.saisie,
              backgroundColor: theme.couleur.marque.primaireTeinte,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icone nom="seance" couleur={theme.couleur.marque.primaire} />
          </View>
          <View style={{ flex: 1, gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
              {seance.titre}
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              {seance.nombreExercices} exercices · {seance.dureeMinutes} min · avec{' '}
              {seance.coach.split(' ')[0]}
            </Text>
          </View>
        </View>
      </Carte>

      <SousTitre texte="Carte programme" />
      <Carte>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.espace[3],
            padding: theme.espace[4],
          }}
        >
          <View
            style={{
              width: theme.taille.avatarLg,
              height: theme.taille.avatarLg,
              borderRadius: theme.rayon.saisie,
              backgroundColor: theme.couleur.marque.secondaire,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icone nom="document" couleur={theme.couleur.marque.secondaireEncre} />
          </View>
          <View style={{ flex: 1, gap: theme.espace[1] }}>
            <Text style={{ ...theme.texte.titre3, color: theme.couleur.texte.principal }}>
              {programme.titre}
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              {programme.nombreModules} modules
              {programme.chargeHebdomadaire ? ` · ${programme.chargeHebdomadaire}` : ''}
            </Text>
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              Module {programme.moduleActuel} sur {programme.nombreModules} · {programme.coach}
            </Text>
            <Progression
              variante="barre"
              valeur={progressionProgramme}
              accessibilityLabel={`Module ${programme.moduleActuel} sur ${programme.nombreModules}`}
            />
          </View>
        </View>
      </Carte>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 9 · Barres de navigation
// ---------------------------------------------------------------------------------------------

function SectionNavigation() {
  const theme = useTheme();

  return (
    <Section titre="9 · Barres de navigation">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[6] }}>
        <View style={{ flex: 1, gap: theme.espace[2] }}>
          <SousTitre texte="Client" />
          <BarreNavigation
            variante="client"
            elements={[
              { icone: 'accueil', libelle: 'Accueil', actif: true },
              { icone: 'recherche', libelle: 'Explorer' },
              { icone: 'seance', libelle: 'Séance' },
              { icone: 'message', libelle: 'Messages' },
              { icone: 'profil', libelle: 'Moi' },
            ]}
          />
        </View>
        <View style={{ flex: 1, gap: theme.espace[2] }}>
          <SousTitre texte="Coach" />
          <BarreNavigation
            variante="coach"
            elements={[
              { icone: 'pilotage', libelle: 'Pilotage', actif: true },
              { icone: 'clients', libelle: 'Clients' },
              { icone: 'ajouter', libelle: 'Créer', misEnAvant: true },
              { icone: 'agenda', libelle: 'Agenda' },
              { icone: 'virement', libelle: 'Revenus' },
            ]}
          />
        </View>
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 10 · Feuille basse et modale
// ---------------------------------------------------------------------------------------------

function SectionFeuilleEtModale() {
  const theme = useTheme();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [modaleOuverte, setModaleOuverte] = useState(false);

  return (
    <Section titre="10 · Feuille basse et modale">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[3] }}>
        <Bouton
          variante="secondaire"
          libelle="Ouvrir la feuille basse"
          onPress={() => setFeuilleOuverte(true)}
        />
        <Bouton
          variante="secondaire"
          libelle="Ouvrir la modale"
          onPress={() => setModaleOuverte(true)}
        />
      </View>

      <FeuilleBasse
        ouverte={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        enfants={
          <View style={{ gap: theme.espace[3] }}>
            <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
              Exemple de feuille basse
            </Text>
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
              Glisse vers le bas pour la fermer, ou touche le voile.
            </Text>
          </View>
        }
      >
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
          Contenu derrière la feuille.
        </Text>
      </FeuilleBasse>

      <Modale
        ouverte={modaleOuverte}
        onFermer={() => setModaleOuverte(false)}
        titre="Exemple de modale"
        corps="Deux actions, la destructrice toujours à droite."
        libelleAction="Annuler"
        onAction={() => setModaleOuverte(false)}
        libelleDestructeur="Supprimer"
        onDestructeur={() => setModaleOuverte(false)}
      >
        <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.attenue }}>
          Contenu derrière la modale.
        </Text>
      </Modale>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 11 · États
// ---------------------------------------------------------------------------------------------

const FORMES_SQUELETTE: FormeSquelette[] = ['liste', 'carte', 'detail', 'ligne'];

function SectionEtats() {
  const theme = useTheme();
  const [nombreEchecs, setNombreEchecs] = useState(0);

  return (
    <Section titre="11 · États">
      <SousTitre texte="Squelette" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[4] }}>
        {FORMES_SQUELETTE.map((forme) => (
          <View key={forme} style={{ gap: theme.espace[2] }}>
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.attenue }}>
              {forme}
            </Text>
            <Squelette forme={forme} />
          </View>
        ))}
      </View>

      <SousTitre texte="Vide" />
      {/* Texte repris tel quel de maquettes/MyFavCoach-System_dc.html, bloc "États système". */}
      <EtatVide
        titre="Aucun coach ne correspond"
        explication="Essaie d'élargir la zone ou de retirer le filtre « en visio »."
        actionPrincipale={{ libelle: 'Réinitialiser les filtres', onPress: () => {} }}
      />

      <SousTitre texte="Chargement" />
      <EtatChargement forme="ligne" nombre={2} />

      <SousTitre texte="Erreur" />
      <EtatErreur
        titre={textesRepliErreur.reseauAbsent.titre}
        explication={textesRepliErreur.reseauAbsent.explication}
        code="ERR_4821"
        nombreEchecs={nombreEchecs}
        onReessayer={() => setNombreEchecs(0)}
        onNousEcrire={() => setNombreEchecs(0)}
      />
      <Bouton
        variante="discret"
        libelle={`Simuler un échec supplémentaire (${nombreEchecs}/3)`}
        onPress={() => setNombreEchecs((n) => Math.min(n + 1, 3))}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// 12 · Icônes
// ---------------------------------------------------------------------------------------------

function SectionIcones() {
  const theme = useTheme();
  const noms = Object.keys(icones) as NomIcone[];

  return (
    <Section titre="12 · Icônes">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[4] }}>
        {noms.map((nom) => (
          <View key={nom} style={{ alignItems: 'center', gap: theme.espace[1] }}>
            <Icone nom={nom} />
            <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}>
              {nom}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// Pied : interrupteurs clair/sombre et mouvement réduit — appliqués à la galerie seule.
// ---------------------------------------------------------------------------------------------

function PiedGalerie({
  themeClair,
  onChangeThemeClair,
  mouvementReduitForce,
  onChangeMouvementReduitForce,
}: ProprietesCorps) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.espace[6] }}>
      <Interrupteur
        theme={theme}
        libelle="Sombre"
        valeur={!themeClair}
        onValueChange={(sombre) => onChangeThemeClair(!sombre)}
      />
      <Interrupteur
        theme={theme}
        libelle="Mouvement réduit"
        valeur={mouvementReduitForce}
        onValueChange={onChangeMouvementReduitForce}
      />
    </View>
  );
}

function Interrupteur({
  theme,
  libelle,
  valeur,
  onValueChange,
}: {
  theme: ThemeResolu;
  libelle: string;
  valeur: boolean;
  onValueChange: (valeur: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[2] }}>
      <Switch
        value={valeur}
        onValueChange={onValueChange}
        trackColor={{ false: theme.couleur.gris[300], true: theme.couleur.marque.primaireTeinte2 }}
        thumbColor={theme.couleur.fond.surface}
      />
      <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}>{libelle}</Text>
    </View>
  );
}
