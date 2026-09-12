import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, TextInput, View } from 'react-native';

import { supabaseAdmin } from '@/services/supabase/client-admin';
import ConnexionAdmin from './connexion';

// L2-10 : back-office de vérification (BO-01). File d'attente (en_examen, plus ancien
// d'abord — fiche, "Ce qui a été inventé"), consultation des pièces, trois décisions. Chaque
// décision passe par decider_verification_coach() (0015), jamais un UPDATE direct — la seule
// écriture que ce fichier fait sur profils_coach/decisions_verification est cet appel RPC.
//
// Consultation des pièces : pieces_verification_pour_examinateur() (0013, SECURITY DEFINER)
// donne chemin_stockage à l'examinateur ; storage.createSignedUrl() ouvre le fichier lui-même,
// TOUJOURS via supabaseAdmin authentifié comme l'examinateur courant — jamais service_role. Les
// deux sens (examinateur accepté, compte ordinaire refusé) sont prouvés au banc
// (src/test/rls.banc.ts, describe "lecture par l'examinateur") avant d'être câblés ici.
type Dossier = {
  coachId: string;
  prenom: string;
  nom: string;
  discipline: string;
  deposeLe: string | null;
};
type PieceConsultable = { type: string; deposeLe: string; cheminStockage: string };

const LIBELLES_PIECE: Record<string, string> = {
  identite: 'Pièce d’identité',
  diplome_ou_certification: 'Diplôme ou certification',
  assurance_rc_pro: 'Attestation d’assurance RC pro',
};

export default function Verification() {
  const [connecte, setConnecte] = useState(false);
  const [dossiers, setDossiers] = useState<Dossier[] | null>(null);
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [dossierOuvert, setDossierOuvert] = useState<string | null>(null);
  const [piecesDuDossier, setPiecesDuDossier] = useState<PieceConsultable[] | null>(null);

  // Ne fait AUCUN setState : renvoie la liste ou lève. Les deux appelants (l'effet ci-dessous,
  // et decider() après une décision) décident eux-mêmes quoi faire du résultat — un effet qui
  // appelle une fonction externe faisant du setState en son sein n'est pas vérifiable
  // statiquement par react-hooks/set-state-in-effect, d'où cette séparation.
  async function chargerFileAttente(): Promise<Dossier[]> {
    const { data, error } = await supabaseAdmin
      .from('profils_coach')
      .select('id, prenom, nom, discipline')
      .eq('statut_verification', 'en_examen');
    if (error) throw error;
    const lignes = (data ?? []) as {
      id: string;
      prenom: string;
      nom: string;
      discipline: string;
    }[];
    const avecDepot = await Promise.all(
      lignes.map(async (l) => {
        const pieces = await supabaseAdmin
          .from('pieces_verification')
          .select('depose_le')
          .eq('coach_id', l.id)
          .order('depose_le', { ascending: true })
          .limit(1);
        const premiereLigne = (pieces.data?.[0] as { depose_le: string } | undefined) ?? null;
        return {
          coachId: l.id,
          prenom: l.prenom,
          nom: l.nom,
          discipline: l.discipline,
          deposeLe: premiereLigne?.depose_le ?? null,
        };
      }),
    );
    avecDepot.sort((a, b) => (a.deposeLe ?? '').localeCompare(b.deposeLe ?? ''));
    return avecDepot;
  }

  useEffect(() => {
    if (!connecte) return;
    let monte = true;
    void chargerFileAttente()
      .then((liste) => {
        if (monte) setDossiers(liste);
      })
      .catch((e: Error) => {
        if (monte) setErreur(e.message);
      });
    return () => {
      monte = false;
    };
  }, [connecte]);

  // pieces_verification_pour_examinateur() renvoie TOUTES les pièces (SECURITY DEFINER, aucun
  // paramètre de filtre côté serveur, 0013_creer_role_examinateur.sql) : filtrées ici, côté
  // client, sur le seul coachId consulté.
  async function ouvrirDossier(coachId: string) {
    setErreur(null);
    setDossierOuvert(coachId);
    setPiecesDuDossier(null);
    const { data, error } = await supabaseAdmin.rpc('pieces_verification_pour_examinateur');
    if (error) {
      setErreur(error.message);
      return;
    }
    const toutes = (data ?? []) as {
      coach_id: string;
      type: string;
      depose_le: string;
      chemin_stockage: string;
    }[];
    setPiecesDuDossier(
      toutes
        .filter((p) => p.coach_id === coachId)
        .map((p) => ({ type: p.type, deposeLe: p.depose_le, cheminStockage: p.chemin_stockage })),
    );
  }

  async function surOuvrirPiece(cheminStockage: string) {
    setErreur(null);
    // 600 s : même durée que le dépôt (docs/api.md §4, "expiration 10 minutes") — pas de raison
    // qu'une lecture par l'examinateur dure plus longtemps qu'un dépôt par le coach.
    const { data, error } = await supabaseAdmin.storage
      .from('pieces-verification')
      .createSignedUrl(cheminStockage, 600);
    if (error || !data?.signedUrl) {
      setErreur(error?.message ?? 'Impossible de générer un lien de consultation.');
      return;
    }
    await Linking.openURL(data.signedUrl);
  }

  async function decider(coachId: string, decision: string) {
    setErreur(null);
    const motif = motifs[coachId]?.trim() ?? '';
    if (decision !== 'verifiee' && motif === '') {
      setErreur('Un motif est requis pour cette décision.');
      return;
    }
    const { error } = await supabaseAdmin.rpc('decider_verification_coach', {
      p_coach_id: coachId,
      p_decision: decision,
      p_motif: motif === '' ? 'Dossier conforme.' : motif,
    });
    if (error) {
      setErreur(error.message);
      return;
    }
    if (dossierOuvert === coachId) {
      setDossierOuvert(null);
      setPiecesDuDossier(null);
    }
    setDossiers(await chargerFileAttente());
  }

  if (!connecte) return <ConnexionAdmin onConnecte={() => setConnecte(true)} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>File d’attente — vérification</Text>
      {erreur ? <Text style={{ color: 'red' }}>{erreur}</Text> : null}
      {dossiers === null ? null : dossiers.length === 0 ? (
        <Text>Aucun dossier en attente.</Text>
      ) : (
        dossiers.map((d) => (
          <View key={d.coachId} style={{ borderWidth: 1, borderRadius: 8, padding: 12, gap: 8 }}>
            <Text style={{ fontWeight: '600' }}>
              {d.prenom} {d.nom} — {d.discipline}
            </Text>
            <Text>
              Déposé le {d.deposeLe ? new Date(d.deposeLe).toLocaleDateString('fr-FR') : '—'}
            </Text>
            <Text
              accessibilityRole="button"
              onPress={() => void ouvrirDossier(d.coachId)}
              style={{ padding: 8, textDecorationLine: 'underline' }}
            >
              Consulter les pièces
            </Text>

            {dossierOuvert === d.coachId ? (
              <View style={{ gap: 6, paddingLeft: 8, borderLeftWidth: 2 }}>
                {piecesDuDossier === null ? (
                  <Text>Chargement…</Text>
                ) : piecesDuDossier.length === 0 ? (
                  <Text>Aucune pièce déposée.</Text>
                ) : (
                  piecesDuDossier.map((p) => (
                    <View
                      key={p.type}
                      style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
                    >
                      <Text>{LIBELLES_PIECE[p.type] ?? p.type}</Text>
                      <Text
                        accessibilityRole="button"
                        onPress={() => void surOuvrirPiece(p.cheminStockage)}
                        style={{ textDecorationLine: 'underline' }}
                      >
                        Ouvrir (lien valable 10 min)
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}

            <TextInput
              placeholder="Motif (requis sauf pour « Vérifier »)"
              value={motifs[d.coachId] ?? ''}
              onChangeText={(v) => setMotifs({ ...motifs, [d.coachId]: v })}
              accessibilityLabel={`Motif pour ${d.prenom} ${d.nom}`}
              style={{ borderWidth: 1, padding: 8, borderRadius: 6 }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text
                accessibilityRole="button"
                onPress={() => void decider(d.coachId, 'verifiee')}
                style={{ padding: 8 }}
              >
                Vérifier
              </Text>
              <Text
                accessibilityRole="button"
                onPress={() => void decider(d.coachId, 'complement_demande')}
                style={{ padding: 8 }}
              >
                Demander un complément
              </Text>
              <Text
                accessibilityRole="button"
                onPress={() => void decider(d.coachId, 'refusee')}
                style={{ padding: 8 }}
              >
                Refuser
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
