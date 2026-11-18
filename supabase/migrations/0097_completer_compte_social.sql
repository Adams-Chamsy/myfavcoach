create or replace function public.creer_compte_depuis_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  date_naissance_brute text := new.raw_user_meta_data ->> 'date_naissance';
  cgu_version_brute text := new.raw_user_meta_data ->> 'cgu_version_acceptee';
  jeton_brut text := new.raw_user_meta_data ->> 'jeton_invitation';
  v_coach_id uuid;
begin
  -- Le fournisseur est posé par Supabase Auth dans app_metadata.
  -- Le compte métier est créé après la confirmation de l'âge et des CGU.
  if new.raw_app_meta_data ->> 'provider' in ('google', 'apple') then
    return new;
  end if;

  if date_naissance_brute is null then
    raise exception 'Inscription refusee : date_naissance absente des metadonnees auth.users (options.data.dateNaissance attendu a l''appel de auth.signUp).';
  end if;

  if cgu_version_brute is null then
    raise exception 'Inscription refusee : cgu_version_acceptee absente des metadonnees auth.users (docs/ecrans/L1-02-creation-compte.md : l''acceptation des CGU doit etre enregistree avec sa version).';
  end if;

  insert into public.comptes (id, date_naissance, cgu_version_acceptee)
  values (new.id, date_naissance_brute::date, cgu_version_brute);

  -- L3bis : lien coach -> compte invité, silencieux si absent ou invalide (voir commentaire
  -- au-dessus de cette fonction).
  if jeton_brut is not null then
    v_coach_id := public.coach_par_jeton_invitation(jeton_brut);
    if v_coach_id is not null then
      insert into public.invitations (coach_id, compte_invite_id, statut, compte_cree_le)
      values (v_coach_id, new.id, 'compte_cree', now());
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.creer_compte_depuis_auth()
  from public, anon, authenticated, service_role;

create function public.completer_compte_social(p_date_naissance date, p_version_cgu text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and u.raw_app_meta_data ->> 'provider' in ('google', 'apple')
  ) then
    raise exception 'session_sociale_requise';
  end if;

  -- Une seconde tentative ne modifie ni la date ni les CGU déjà enregistrées.
  if exists (select 1 from public.comptes where id = auth.uid()) then
    return;
  end if;
  if p_version_cgu is distinct from '2026-09-04' then
    raise exception 'version_cgu_invalide';
  end if;
  if p_date_naissance is null or age(p_date_naissance) < interval '18 years' then
    raise exception 'age_insuffisant';
  end if;
  insert into public.comptes (id, date_naissance, cgu_version_acceptee)
  values (auth.uid(), p_date_naissance, p_version_cgu)
  on conflict (id) do nothing;
end;
$$;
revoke execute on function public.completer_compte_social(date, text)
  from public, anon, authenticated, service_role;
grant execute on function public.completer_compte_social(date, text) to authenticated;
