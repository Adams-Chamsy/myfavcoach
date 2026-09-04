-- Déclencheur : le poids de départ/visé ne s'écrit qu'avec un consentement de santé actif.
-- docs/ecrans/L1-05-onboarding-client.md, étape 3/4 ; docs/domaine.md §3.12 : "Le consentement
-- donneesSante conditionne l'écriture de MesureCorporelle" — poids_depart_grammes et
-- poids_cible_grammes (0001_creer_identite.sql, profils_client) EN sont une, la seule que ce
-- lot écrit. Sans ce déclencheur, profils_client_update_espace_client (0002_politiques.sql)
-- autorise déjà l'écriture de ces deux colonnes, sans aucune condition de consentement : trouvé
-- en préparant P1.11, pas une régression — la politique n'a jamais prétendu porter cette règle,
-- personne ne l'avait encore ajoutée.
--
-- Pas une contrainte CHECK, même raison que verifier_age_majeur (0001_creer_identite.sql) : une
-- CHECK ne peut pas interroger une AUTRE table (consentements_courants), seul un déclencheur le
-- peut.
--
-- Pas une simple politique RLS (WITH CHECK sur profils_client_update_espace_client) non plus,
-- délibérément : une politique WITH CHECK revalide l'état COMPLET de la ligne à CHAQUE écriture,
-- pas seulement ce qui change dans cette écriture précise. Avec un poids déjà enregistré, un
-- consentement retiré plus tard bloquerait alors TOUTE modification future de la ligne (changer
-- son prénom, par exemple) — alors que docs/domaine.md §3.12 dit explicitement "Son retrait ne
-- supprime pas les données : il bloque l'écriture", pas "bloque toute écriture future sur la
-- ligne entière". Un déclencheur peut comparer OLD et NEW pour ne réagir que quand le poids
-- LUI-MÊME change vers une valeur non nulle — la bonne portée pour cette règle.
--
-- security invoker (implicite, pas de "security definer") : le contrôle ne lit que les
-- consentements du compte appelant (new.compte_id = auth.uid(), déjà garanti par
-- profils_client_update_espace_client). consentements_select_proprietaire (0002_politiques.sql)
-- autorise déjà cette lecture pour le propriétaire — aucun besoin de contourner RLS ici,
-- contrairement à basculer_profil/profil_actif_courant (docs/backend.md §7).
create or replace function public.verifier_consentement_sante_poids()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  poids_change boolean;
begin
  if tg_op = 'INSERT' then
    poids_change := new.poids_depart_grammes is not null or new.poids_cible_grammes is not null;
  else
    poids_change := (new.poids_depart_grammes is distinct from old.poids_depart_grammes
                      and new.poids_depart_grammes is not null)
                  or (new.poids_cible_grammes is distinct from old.poids_cible_grammes
                      and new.poids_cible_grammes is not null);
  end if;

  if poids_change and not exists (
    select 1 from public.consentements_courants
    where compte_id = new.compte_id and type = 'donneesSante' and accorde
  ) then
    raise exception 'Écriture du poids refusée : consentement donneesSante absent ou retiré.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_consentement_sante_poids
  before insert or update on public.profils_client
  for each row
  execute function public.verifier_consentement_sante_poids();
