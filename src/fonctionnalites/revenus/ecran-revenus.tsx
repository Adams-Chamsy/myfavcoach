import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { Bouton } from '@/composants/bouton';
import { DefilementEcran } from '@/composants/canevas-ecran';
import { Carte } from '@/composants/carte';
import { EtatErreur } from '@/composants/etats/etat-erreur';
import { textesRepliErreur } from '@/composants/etats/textes';
import { Icone } from '@/composants/icones';
import { Modale } from '@/composants/modale';
import { Squelette } from '@/composants/squelette';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import type {
  Identification,
  RefusServeur,
  RevenusMois,
  Solde,
  StatutVersement,
  Versement,
} from '@/services/donnees/port';
import { dateCourte, euros } from '@/fonctionnalites/factures/format';
import { useTheme } from '@/theme/fournisseur';
import { ecouterFacturationEnregistree } from './facturation-enregistree';

// docs/ecrans/L5-13-revenus.md (écran 13). Ce que le coach a gagné ce mois-ci, ce que la
// plateforme a pris, quand l'argent arrive, et le virement immédiat ; tant qu'il n'est pas en
// règle (docs/domaine.md §3.3), ce qu'il lui reste à faire. Tout vient du serveur : aucun montant
// ni aucune date calculés ici, sauf la mise en forme.

export type ProprietesEcranRevenus = {
  // Le formulaire des informations de facturation (identité fiscale).
  onOuvrirFacturation: () => void;
  onOuvrirFactures: () => void;
  // La page d'inscription du prestataire : navigateur intégré sur iOS/Android (la promesse se
  // résout quand il se ferme), même onglet sur web. Fournie par la route.
  ouvrirPage: (url: string) => Promise<void>;
};

type Donnees = {
  identification: Identification;
  solde: Solde;
  versements: Versement[];
  revenus: RevenusMois[];
};

type RetourVersement =
  | { type: 'envoye' }
  | { type: 'demain' }
  | { type: 'echoue' }
  | { type: 'refus'; refus: RefusServeur }
  | { type: 'sans_reponse' };

const SEUIL_VERSEMENT_CENTIMES = 2000;

function dateDe(iso: string, options: Intl.DateTimeFormatOptions): string {
  const jour = iso.length === 10 ? `${iso}T12:00:00Z` : iso;
  return new Date(jour).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', ...options });
}

function majuscule(texte: string): string {
  return `${texte.charAt(0).toLocaleUpperCase('fr-FR')}${texte.slice(1)}`;
}

// Le jour de Paris, AAAA-MM-JJ : le mois que l'écran demande au serveur.
function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

export const LIBELLES_STATUT_VERSEMENT: Record<StatutVersement, string> = {
  prevu: 'Prévu',
  en_cours: 'En cours',
  verse: 'Versé',
  echoue: 'Échoué',
};

export function EcranRevenus({
  onOuvrirFacturation,
  onOuvrirFactures,
  ouvrirPage,
}: ProprietesEcranRevenus) {
  const theme = useTheme();
  const { port } = useDonnees();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [cleTentative, setCleTentative] = useState(0);
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<RetourVersement | null>(null);
  const [lienEnCours, setLienEnCours] = useState(false);
  const [refusLien, setRefusLien] = useState<RefusServeur | 'sans_reponse' | null>(null);
  const pageOuverte = useRef(false);

  const relire = useCallback(() => setCleTentative((c) => c + 1), []);

  useEffect(() => {
    let monte = true;
    void Promise.all([
      port.lireIdentification(),
      port.lireSolde(),
      port.lireVersements(),
      port.lireRevenus(aujourdhuiParis()),
    ])
      .then(([identification, solde, versements, revenus]) => {
        if (!monte) return;
        setDonnees({ identification, solde, versements, revenus });
        setErreur(false);
      })
      .catch(() => {
        if (monte) setErreur(true);
      });
    return () => {
      monte = false;
    };
  }, [port, cleTentative]);

  // Retour du formulaire de facturation : Revenus, resté monté sous lui, relit.
  useEffect(() => ecouterFacturationEnregistree(relire), [relire]);

  // Retour de la page d'inscription : l'application revient au premier plan, l'état se relit.
  useEffect(() => {
    const ecoute = AppState.addEventListener('change', (statut) => {
      if (statut === 'active' && pageOuverte.current) {
        pageOuverte.current = false;
        relire();
      }
    });
    return () => ecoute.remove();
  }, [relire]);

  async function ouvrirInscription() {
    if (lienEnCours) return;
    setLienEnCours(true);
    setRefusLien(null);
    try {
      const resultat = await port.demanderLienIdentification();
      if (resultat.issue === 'ok') {
        pageOuverte.current = true;
        await ouvrirPage(resultat.url);
        if (pageOuverte.current) {
          pageOuverte.current = false;
          relire();
        }
      } else {
        setRefusLien(resultat.issue === 'refusee' ? resultat.refus : 'sans_reponse');
      }
    } finally {
      setLienEnCours(false);
    }
  }

  async function virer() {
    setConfirmation(false);
    if (envoi) return;
    setEnvoi(true);
    setRetour(null);
    try {
      const resultat = await port.demanderVersement();
      if (resultat.issue === 'ok') {
        setRetour(
          resultat.statut === 'verse' || resultat.statut === 'en_cours'
            ? { type: 'envoye' }
            : resultat.statut === 'prevu'
              ? { type: 'demain' }
              : { type: 'echoue' },
        );
      } else {
        setRetour(
          resultat.issue === 'refusee'
            ? { type: 'refus', refus: resultat.refus }
            : { type: 'sans_reponse' },
        );
      }
      relire();
    } finally {
      setEnvoi(false);
    }
  }

  if (erreur) {
    return (
      <View style={{ flex: 1, padding: theme.espace.gouttiere, justifyContent: 'center' }}>
        <EtatErreur
          titre={textesRepliErreur.serveur.titre}
          explication={textesRepliErreur.serveur.explication}
          nombreEchecs={0}
          onReessayer={relire}
        />
      </View>
    );
  }
  if (!donnees) {
    return (
      <View style={{ padding: theme.espace.gouttiere }}>
        <Squelette forme="detail" />
      </View>
    );
  }

  const { identification, solde, versements, revenus } = donnees;
  const mois = revenus[0];
  const raisonInactif = !solde.compteOperationnel
    ? 'Termine d’abord ton inscription auprès de notre prestataire de paiement.'
    : solde.versementEnCours
      ? 'Un virement est déjà en route.'
      : solde.soldeCentimes < SEUIL_VERSEMENT_CENTIMES
        ? 'Un virement part à partir de 20 € de solde.'
        : null;
  const montantVire = solde.soldeCentimes - 100;

  const texte = (
    contenu: string,
    style: keyof typeof theme.texte = 'corps',
    couleur: string = theme.couleur.texte.principal,
  ) => <Text style={{ ...theme.texte[style], color: couleur }}>{contenu}</Text>;

  return (
    <Modale
      ouverte={confirmation}
      onFermer={() => setConfirmation(false)}
      titre={`Virer ${euros(montantVire)} maintenant ?`}
      corps="1 € de frais est retenu sur ton solde."
      // « Virer » en bouton marqué : un virement ne se reprend pas. « Annuler » est l'action sûre.
      libelleAction="Annuler"
      onAction={() => setConfirmation(false)}
      libelleDestructeur="Virer"
      onDestructeur={() => void virer()}
      destructeurOccupe={envoi}
    >
      <DefilementEcran
        contentContainerStyle={{
          padding: theme.espace.gouttiere,
          gap: theme.espace[6],
        }}
      >
        {!identification.peutPublier ? (
          <View style={{ gap: theme.espace[3] }}>
            {texte('Ce qu’il te reste à faire', 'label', theme.couleur.texte.secondaire)}
            {!identification.identiteFiscaleComplete ? (
              <Carte>
                <View style={{ padding: theme.espace[4], gap: theme.espace[2] }}>
                  {texte('Tes informations de facturation', 'titre3')}
                  {texte(
                    'Elles figurent sur les factures émises en ton nom.',
                    'petit',
                    theme.couleur.texte.secondaire,
                  )}
                  <Bouton
                    libelle="Renseigner"
                    variante="secondaire"
                    onPress={onOuvrirFacturation}
                  />
                </View>
              </Carte>
            ) : null}
            {identification.compteVersement !== 'operationnel' ? (
              <Carte>
                <View style={{ padding: theme.espace[4], gap: theme.espace[2] }}>
                  {texte('Ton compte de versement', 'titre3')}
                  {identification.compteVersement === 'en_verification'
                    ? texte(
                        'Notre prestataire vérifie tes informations. Rien à faire de ton côté.',
                        'petit',
                        theme.couleur.texte.secondaire,
                      )
                    : texte(
                        identification.compteVersement === 'restreint'
                          ? 'Notre prestataire a bloqué ton compte de versement. Ouvre ton inscription pour voir ce qu’il te demande.'
                          : 'Pour recevoir ton argent, termine ton inscription auprès de notre prestataire de paiement.',
                        'petit',
                        theme.couleur.texte.secondaire,
                      )}
                  {identification.compteVersement !== 'en_verification' ? (
                    <Bouton
                      libelle={
                        lienEnCours
                          ? 'Ouverture…'
                          : identification.compteVersement === 'restreint'
                            ? 'Ouvrir mon inscription'
                            : 'Continuer mon inscription'
                      }
                      variante="primaire"
                      desactive={lienEnCours}
                      onPress={() => void ouvrirInscription()}
                    />
                  ) : null}
                  {refusLien === 'sans_reponse' ? (
                    texte('Pas de connexion. Réessaie.', 'petit', theme.couleur.etat.erreurEncre)
                  ) : refusLien ? (
                    <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
                      {texte(refusLien.title, 'label', theme.couleur.etat.erreurEncre)}
                      {texte(refusLien.detail, 'petit', theme.couleur.etat.erreurEncre)}
                    </View>
                  ) : null}
                </View>
              </Carte>
            ) : null}
          </View>
        ) : null}

        {mois ? (
          <View style={{ gap: theme.espace[1] }}>
            {texte(
              majuscule(dateDe(mois.mois, { month: 'long', year: 'numeric' })),
              'label',
              theme.couleur.texte.secondaire,
            )}
            {texte('Net à percevoir', 'corps', theme.couleur.texte.secondaire)}
            <Text
              accessibilityRole="header"
              style={{ ...theme.texte.display, color: theme.couleur.texte.principal }}
            >
              {euros(mois.netCentimes)}
            </Text>
          </View>
        ) : null}

        {revenus.length > 0 ? <Histogramme revenus={revenus} /> : null}

        {mois ? (
          <Carte>
            <View style={{ padding: theme.espace[4], gap: theme.espace[3] }}>
              <Ligne
                libelle={`${mois.nombrePaiements} ${mois.nombrePaiements > 1 ? 'abonnements' : 'abonnement'}`}
                valeur={euros(mois.encaissementsCentimes)}
              />
              <Ligne
                libelle="Commission plateforme"
                valeur={`−${euros(mois.commissionCentimes)}`}
                couleur={theme.couleur.etat.erreurEncre}
              />
              <View
                style={{
                  height: theme.taille.bordureFine,
                  backgroundColor: theme.couleur.bordure.discrete,
                }}
              />
              <Ligne libelle="Total net" valeur={euros(mois.netCentimes)} fort />
            </View>
          </Carte>
        ) : null}

        <Carte>
          <View style={{ padding: theme.espace[4], gap: theme.espace[3] }}>
            <Ligne libelle="Solde disponible" valeur={euros(solde.soldeCentimes)} fort />
            {texte(
              `Prochain virement le ${dateCourte(solde.prochainVersementLe)}`,
              'petit',
              theme.couleur.texte.secondaire,
            )}
            <Bouton
              libelle={envoi ? 'Envoi en cours…' : 'Virement immédiat · 1 €'}
              variante="primaire"
              desactive={raisonInactif !== null || envoi}
              accessibilityLabel={
                raisonInactif ? `Virement immédiat, 1 € de frais. ${raisonInactif}` : undefined
              }
              onPress={() => setConfirmation(true)}
            />
            {raisonInactif ? texte(raisonInactif, 'petit', theme.couleur.texte.secondaire) : null}
            {retour ? <MessageVersement retour={retour} /> : null}
          </View>
        </Carte>

        <View style={{ gap: theme.espace[2] }}>
          {texte('Derniers virements', 'titre3')}
          {versements.length === 0
            ? texte('Aucun virement pour l’instant.', 'petit', theme.couleur.texte.secondaire)
            : versements.map((v) => (
                <View
                  key={v.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.espace[2],
                    paddingVertical: theme.espace[2],
                    borderBottomWidth: theme.taille.bordureFine,
                    borderBottomColor: theme.couleur.bordure.discrete,
                  }}
                >
                  <View style={{ flex: 1, gap: theme.espace[1] }}>
                    {texte(dateCourte(v.verseLe ?? v.emisLe))}
                    {texte(
                      v.mode === 'immediat'
                        ? `${LIBELLES_STATUT_VERSEMENT[v.statut]} · virement immédiat`
                        : LIBELLES_STATUT_VERSEMENT[v.statut],
                      'petit',
                      v.statut === 'echoue'
                        ? theme.couleur.etat.erreurEncre
                        : theme.couleur.texte.secondaire,
                    )}
                  </View>
                  {texte(euros(v.montantCentimes), 'titre3')}
                </View>
              ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes factures"
          onPress={onOuvrirFactures}
          style={{
            minHeight: theme.taille.tapMin,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {texte('Mes factures')}
          <Icone nom="suivant" couleur={theme.couleur.texte.secondaire} />
        </Pressable>
      </DefilementEcran>
    </Modale>
  );
}

function Ligne({
  libelle,
  valeur,
  fort,
  couleur,
}: {
  libelle: string;
  valeur: string;
  fort?: boolean;
  couleur?: string;
}) {
  const theme = useTheme();
  const style = fort ? theme.texte.titre3 : theme.texte.corps;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.espace[2] }}>
      <Text style={{ ...style, flex: 1, color: theme.couleur.texte.principal }}>{libelle}</Text>
      <Text style={{ ...style, color: couleur ?? theme.couleur.texte.principal }}>{valeur}</Text>
    </View>
  );
}

// Six barres, du plus ancien au plus récent, chacune libellée de son mois. Le lecteur d'écran lit
// une seule phrase avec les six montants : un dessin ne se lit pas.
function Histogramme({ revenus }: { revenus: RevenusMois[] }) {
  const theme = useTheme();
  const chronologiques = [...revenus].reverse();
  const plusGrand = Math.max(1, ...chronologiques.map((r) => r.netCentimes));
  const hauteurMax = theme.espace[16] * 2;
  const resume = chronologiques
    .map((r) => `${dateDe(r.mois, { month: 'long' })} ${euros(r.netCentimes)}`)
    .join(', ');
  return (
    <View
      accessible
      accessibilityLabel={`Net des six derniers mois : ${resume}`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.espace[2] }}
    >
      {chronologiques.map((r, i) => (
        <View key={r.mois} style={{ flex: 1, alignItems: 'center', gap: theme.espace[1] }}>
          <View
            style={{
              width: '100%',
              height: Math.max(theme.espace[1], (r.netCentimes / plusGrand) * hauteurMax),
              borderRadius: theme.rayon.badge,
              backgroundColor:
                i === chronologiques.length - 1
                  ? theme.couleur.marque.primaire
                  : theme.couleur.bordure.discrete,
            }}
          />
          <Text style={{ ...theme.texte.legende, color: theme.couleur.texte.secondaire }}>
            {dateDe(r.mois, { month: 'short' }).replace('.', '')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MessageVersement({ retour }: { retour: RetourVersement }) {
  const theme = useTheme();
  const phrase = (t: string, couleur: string) => (
    <Text accessibilityLiveRegion="polite" style={{ ...theme.texte.petit, color: couleur }}>
      {t}
    </Text>
  );
  switch (retour.type) {
    case 'envoye':
      return phrase('Virement envoyé.', theme.couleur.etat.succesEncre);
    case 'demain':
      return phrase('Ton virement partira demain.', theme.couleur.texte.principal);
    case 'echoue':
      return phrase(
        'Notre prestataire a refusé ce virement. Ton solde est intact.',
        theme.couleur.etat.erreurEncre,
      );
    case 'sans_reponse':
      return phrase('Pas de connexion. Réessaie.', theme.couleur.etat.erreurEncre);
    case 'refus':
      return (
        <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
          <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
            {retour.refus.title}
          </Text>
          <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
            {retour.refus.detail}
          </Text>
        </View>
      );
  }
}
