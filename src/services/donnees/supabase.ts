import { supabase } from '@/services/supabase/client';
import type { EtatProfils, PortDonnees, ProfilActif } from './port';

export const portDonneesSupabase: PortDonnees = {
  async lireEtatProfils() {
    // Trois appels, jamais une nouvelle vue/migration pour ce lot (P1.10 reste dans le
    // périmètre annoncé) : profil_actif_courant() est la fonction SECURITY DEFINER déjà posée
    // par 0002_politiques.sql pour cet usage exact ("Seule source du profil actif... jamais un
    // en-tête falsifiable"). Les deux lectures d'existence s'appuient sur les politiques RLS
    // déjà prouvées par P1.5 (profils_client_select_proprietaire, profils_coach_select_
    // proprietaire) : chacune ne peut renvoyer QUE la ligne de l'appelant, ou aucune.
    const [{ data: profilActif, error: erreurProfilActif }, client, coach] = await Promise.all([
      supabase.rpc('profil_actif_courant'),
      supabase.from('profils_client').select('id').limit(1),
      supabase.from('profils_coach').select('id').limit(1),
    ]);

    if (erreurProfilActif) throw erreurProfilActif;
    if (client.error) throw client.error;
    if (coach.error) throw coach.error;

    return {
      profilActif: profilActif as ProfilActif,
      clientExiste: (client.data?.length ?? 0) > 0,
      coachExiste: (coach.data?.length ?? 0) > 0,
    } satisfies EtatProfils;
  },
} satisfies PortDonnees;
