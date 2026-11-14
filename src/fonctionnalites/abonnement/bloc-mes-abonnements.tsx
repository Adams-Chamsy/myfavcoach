import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Badge, type StatutBadge } from '@/composants/badge';
import { Bouton } from '@/composants/bouton';
import { Carte } from '@/composants/carte';
import { Chip } from '@/composants/chip';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { FeuilleBasse } from '@/composants/feuille-basse';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type {
  AbonnementClient,
  StatutAbonnement,
  TransitionAbonnement,
} from '@/services/donnees/port';
import { useTheme } from '@/theme/fournisseur';

// docs/ecrans/L4-24b-mes-abonnements.md — le bloc « Mes abonnements » de l'écran compte, espace
// client. Deux obligations : la résiliation en ligne, et (plus tard) le point d'entrée de
// l'écran 20. Chaque action est une demande, le serveur tranche, et l'écran RELIT après chaque
// action (jamais de mise à jour optimiste, fiche, Règles). Lecture locale au bloc, pas dans
// FournisseurDonnees : les abonnements ne font pas partie d'EtatProfils (décision du 12 novembre
// 2026, docs/decisions-en-attente.md).
//
// « Mettre en pause » (13 novembre 2026) : 2, 4, 6 ou 8 semaines, pas de durée libre
// (docs/domaine.md §4.3). L'écran envoie une durée en jours, le serveur calcule la date de fin
// (0059) : aucune date n'est calculée ici.
//
// Encore en attente (docs/decisions-en-attente.md) : pour `impaye` et `suspendu`, la ligne datée
// et l'action « Régler » (date servie par l'étape serveur à venir, écran 20 pas encore construit).

const DUREES_PAUSE_SEMAINES = [2, 4, 6, 8] as const;

// Les états affichés (fiche, tableau) ; `resilie` et `annule` n'apparaissent pas (C-05, L5).
const ETATS: Partial<Record<StatutAbonnement, { libelle: string; badge: StatutBadge }>> = {
  actif: { libelle: 'ACTIF', badge: 'succes' },
  en_attente_confirmation: { libelle: 'EN ATTENTE', badge: 'neutre' },
  en_pause: { libelle: 'EN PAUSE', badge: 'neutre' },
  impaye: { libelle: 'PAIEMENT REFUSÉ', badge: 'erreur' },
  suspendu: { libelle: 'SUSPENDU', badge: 'erreur' },
  resiliation_programmee: { libelle: 'RÉSILIATION PROGRAMMÉE', badge: 'alerte' },
};

function dateLongue(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function prixMensuel(centimes: number): string {
  return `${(centimes / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €/mois`;
}

function ligneInformation(a: AbonnementClient): string | null {
  switch (a.statut) {
    case 'actif':
      return a.prochainPrelevementLe
        ? `Prochain prélèvement le ${dateLongue(a.prochainPrelevementLe)}. Résiliation effective en fin de période, sans frais.`
        : null;
    case 'en_attente_confirmation':
      return 'Ta banque n’a pas encore confirmé le premier prélèvement.';
    case 'en_pause':
      return a.pauseJusquLe ? `En pause jusqu’au ${dateLongue(a.pauseJusquLe)}.` : null;
    case 'resiliation_programmee':
      return a.finAccesLe ? `Ton suivi s’arrête le ${dateLongue(a.finAccesLe)}.` : null;
    default:
      return null;
  }
}

export function BlocMesAbonnements() {
  const theme = useTheme();
  const { port } = useDonnees();
  const [abonnements, setAbonnements] = useState<AbonnementClient[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [aResilier, setAResilier] = useState<AbonnementClient | null>(null);
  const [aPauser, setAPauser] = useState<AbonnementClient | null>(null);
  const [semaines, setSemaines] = useState<number | null>(null);
  // Le refus pause_deja_utilisee, avec le jour où une pause redevient possible (rendu par le
  // serveur, AAAA-MM-JJ) : affiché sur la carte, en toutes lettres.
  const [pauseRefusee, setPauseRefusee] = useState<{
    id: string;
    possibleLe: string | null;
  } | null>(null);

  const relire = useCallback(async () => {
    try {
      setAbonnements(await port.lireMesAbonnements());
      setErreurLecture(false);
    } catch {
      setErreurLecture(true);
    }
  }, [port]);

  useEffect(() => {
    let monte = true;
    void port
      .lireMesAbonnements()
      .then((lus) => {
        if (monte) setAbonnements(lus);
      })
      .catch(() => {
        if (monte) setErreurLecture(true);
      });
    return () => {
      monte = false;
    };
  }, [port]);

  async function agir(a: AbonnementClient, transition: TransitionAbonnement) {
    setRefus(null);
    setAccuse(null);
    setEnCours(a.id);
    try {
      const resultat = await port.transitionAbonnement(a.id, transition);
      if (!resultat.succes) setRefus(a.id);
      else if (transition === 'resilier') setAccuse(a.id);
      await relire();
    } finally {
      setEnCours(null);
    }
  }

  async function mettreEnPause(a: AbonnementClient, jours: number) {
    setRefus(null);
    setAccuse(null);
    setPauseRefusee(null);
    setEnCours(a.id);
    try {
      const resultat = await port.demanderPause(a.id, jours);
      if (!resultat.succes) {
        if (resultat.code === 'pause_deja_utilisee') {
          setPauseRefusee({ id: a.id, possibleLe: resultat.possibleLe });
        } else setRefus(a.id);
      }
      await relire();
    } finally {
      setEnCours(null);
    }
  }

  function fermerPause() {
    setAPauser(null);
    setSemaines(null);
  }

  const visibles = (abonnements ?? []).filter((a) => ETATS[a.statut]);

  if (erreurLecture) {
    return (
      <EtatErreur
        titre={textesRepliErreur.serveur.titre}
        explication={textesRepliErreur.serveur.explication}
        nombreEchecs={0}
        onReessayer={() => void relire()}
      />
    );
  }
  if (abonnements === null) return <Squelette forme="carte" />;
  // Aucun abonnement affichable : le bloc entier est absent (fiche, Règles).
  if (visibles.length === 0) return null;

  return (
    <Modale
      ouverte={aResilier !== null}
      onFermer={() => setAResilier(null)}
      titre="Résilier ton abonnement ?"
      corps={
        aResilier?.prochainPrelevementLe
          ? `Ton suivi avec ${aResilier.coachPrenom ?? 'ton coach'} s’arrête le ${dateLongue(aResilier.prochainPrelevementLe)}. Aucun autre prélèvement.`
          : ''
      }
      libelleAction="Garder mon abonnement"
      onAction={() => setAResilier(null)}
      libelleDestructeur="Résilier"
      onDestructeur={() => {
        const cible = aResilier;
        setAResilier(null);
        if (cible) void agir(cible, 'resilier');
      }}
    >
      <FeuilleBasse
        ouverte={aPauser !== null}
        onFermer={fermerPause}
        enfants={
          <View style={{ gap: theme.espace[4] }}>
            <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
              Mettre en pause
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.espace[2] }}>
              {DUREES_PAUSE_SEMAINES.map((n) => (
                <Chip
                  key={n}
                  variante="selection"
                  libelle={`${n} semaines`}
                  selectionne={semaines === n}
                  onPress={() => setSemaines(n)}
                />
              ))}
            </View>
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.principal }}>
              {`Aucun prélèvement pendant la pause, et pas d’accès au programme. Ta place chez ${aPauser?.coachPrenom ?? 'ton coach'} est gardée.`}
            </Text>
            <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
              Une seule pause par période de 12 mois.
            </Text>
            <Bouton
              libelle="Mettre en pause"
              variante="primaire"
              desactive={semaines === null}
              onPress={() => {
                const cible = aPauser;
                const jours = semaines === null ? null : semaines * 7;
                fermerPause();
                if (cible && jours !== null) void mettreEnPause(cible, jours);
              }}
            />
          </View>
        }
      >
        <View style={{ gap: theme.espace[3] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.texte.secondaire }}>
            {`Mes abonnements · ${visibles.length}`}
          </Text>
          {visibles.map((a) => {
            const etat = ETATS[a.statut]!;
            const ligne = ligneInformation(a);
            const occupe = enCours === a.id;
            return (
              <Carte key={a.id}>
                <View style={{ padding: theme.espace[4], gap: theme.espace[2] }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.espace[2],
                    }}
                  >
                    <Text
                      style={{
                        ...theme.texte.titre3,
                        flex: 1,
                        color: theme.couleur.texte.principal,
                      }}
                    >
                      {[a.coachPrenom, a.coachNom].filter(Boolean).join(' ')}
                    </Text>
                    <Badge statut={etat.badge} libelle={etat.libelle} />
                  </View>
                  <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.secondaire }}>
                    {[a.offreTitre, prixMensuel(a.prixFigeCentimes)].filter(Boolean).join(' · ')}
                  </Text>
                  {ligne ? (
                    <Text style={{ ...theme.texte.petit, color: theme.couleur.texte.principal }}>
                      {ligne}
                    </Text>
                  ) : null}
                  {accuse === a.id ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{ ...theme.texte.petit, color: theme.couleur.etat.succesEncre }}
                    >
                      Résiliation enregistrée.
                    </Text>
                  ) : null}
                  {refus === a.id ? (
                    <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
                      <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
                        {textesRepliErreur.serveur.titre}
                      </Text>
                      <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
                        {textesRepliErreur.serveur.explication}
                      </Text>
                    </View>
                  ) : null}
                  {pauseRefusee?.id === a.id ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}
                    >
                      {pauseRefusee.possibleLe
                        ? `Tu as déjà fait une pause ces 12 derniers mois. Tu pourras en refaire une à partir du ${dateLongue(pauseRefusee.possibleLe)}.`
                        : 'Tu as déjà fait une pause ces 12 derniers mois.'}
                    </Text>
                  ) : null}
                  {a.statut === 'actif' ? (
                    <Bouton
                      libelle="Mettre en pause"
                      variante="secondaire"
                      onPress={() => setAPauser(a)}
                      desactive={occupe}
                    />
                  ) : null}
                  {a.statut === 'actif' ? (
                    <Bouton
                      libelle="Résilier"
                      variante="secondaire"
                      onPress={() => setAResilier(a)}
                      desactive={occupe}
                    />
                  ) : null}
                  {a.statut === 'en_pause' ? (
                    <Bouton
                      libelle="Reprendre"
                      variante="secondaire"
                      onPress={() => void agir(a, 'reprendre')}
                      desactive={occupe}
                    />
                  ) : null}
                  {a.statut === 'resiliation_programmee' ? (
                    <Bouton
                      libelle="Annuler la résiliation"
                      variante="secondaire"
                      onPress={() => void agir(a, 'annuler_resiliation')}
                      desactive={occupe}
                    />
                  ) : null}
                </View>
              </Carte>
            );
          })}
        </View>
      </FeuilleBasse>
    </Modale>
  );
}
