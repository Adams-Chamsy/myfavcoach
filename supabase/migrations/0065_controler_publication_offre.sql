-- Contrôle à la publication d'une offre (15 novembre 2026, P4.11a ; docs/domaine.md §2 et §3.3,
-- docs/dette.md). Deux règles, au seul endroit qui peut les tenir : le texte vient d'un coach,
-- aucun test d'écran ne l'empêche de l'écrire.
--
-- 1. Les termes interdits de docs/domaine.md §2 (règle des magasins d'applications : on vend un
--    service rendu par une personne, jamais un accès à du contenu). Une offre dont le titre, la
--    description ou un bénéfice porte l'un d'eux n'est pas publiée : termes_interdits. Refus, pas
--    signalement pour modération : aucune file de modération n'existe avant L8, et un refus se
--    lève en retirant un mot.
-- 2. L'engagement « messagerie avec délai de réponse annoncé » (§3.3) tant que la messagerie
--    n'existe pas (L8) : engagement_messagerie_indisponible. La promesse serait invérifiable
--    (docs/perimetre.md §4, risque du 1er novembre 2026). L8 lèvera cette règle par une migration.
--
-- Ni l'une ni l'autre ne touche un brouillon (on enregistre ce qu'on veut), ni une offre déjà
-- publiée : le contrôle se fait au moment de publier.
--
-- La liste des motifs est la même que src/test/libelles-interdits.ts, la liste unique du dépôt
-- (docs/prompts/L4.md, point 11) : src/test/termes-interdits-synchronises.test.ts échoue si
-- l'une change sans l'autre. Motifs insensibles à la casse, qui attrapent les formes fléchies.

create or replace function public.terme_interdit_dans(p_texte text)
returns text
language sql
immutable
set search_path = public
as $$
  select t.terme
    from (values
      (1, 'débloquer', 'd[ée]bloqu'),
      (2, 'déverrouiller', 'd[ée]verrouill'),
      (3, 'premium', 'premium'),
      (4, 'illimité', 'illimit'),
      (5, 'exclusif', 'exclusi(f|ve|vit)'),
      (6, 'accès au contenu', 'acc[èe]s au contenu'),
      (7, 'accéder au contenu', 'acc[ée]der au contenu'),
      (8, 'bibliothèque', 'biblioth[èe]que'),
      (9, 'VIP', '\mvip\M'),
      (10, 'version complète', 'version compl[èe]te')
    ) as t (ordre, terme, motif)
   where coalesce(p_texte, '') ~* t.motif
   order by t.ordre
   limit 1;
$$;

-- Aucun rôle de l'application n'appelle cette fonction : publier_offre (security definer) seule.
revoke execute on function public.terme_interdit_dans(text)
  from public, anon, authenticated, service_role;

-- publier_offre : les trois vérifications de 0008, inchangées et dans le même ordre, puis les
-- deux règles ci-dessus. Même signature : create or replace conserve les droits (0031).
create or replace function public.publier_offre(offre_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offre public.offres;
  v_verifiee boolean;
  v_terme text;
begin
  select o.* into v_offre
    from public.offres o
   where o.id = offre_id
     and o.coach_id in (select id from public.profils_coach where compte_id = auth.uid());

  if not found then
    raise exception 'offre introuvable ou non possedee par ce compte';
  end if;

  if coalesce(array_length(v_offre.engagement_humain, 1), 0) = 0 then
    raise exception 'engagement_humain_requis';
  end if;

  select pc.statut_verification = 'verifiee' into v_verifiee
    from public.profils_coach pc
   where pc.id = v_offre.coach_id;
  if not coalesce(v_verifiee, false) then
    raise exception 'coach_non_verifie';
  end if;

  v_terme := public.terme_interdit_dans(
    concat_ws(' ', v_offre.titre, v_offre.description, array_to_string(v_offre.benefices, ' '))
  );
  if v_terme is not null then
    -- Le terme trouvé part en DETAIL de la levée : jamais affiché tel quel, lisible au journal.
    raise exception 'termes_interdits' using detail = v_terme;
  end if;

  if 'messagerie avec délai de réponse annoncé' = any (v_offre.engagement_humain) then
    raise exception 'engagement_messagerie_indisponible';
  end if;

  update public.offres set publiee_le = now(), retiree_le = null where id = offre_id;
end;
$$;

revoke execute on function public.publier_offre(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.publier_offre(uuid) to authenticated;
