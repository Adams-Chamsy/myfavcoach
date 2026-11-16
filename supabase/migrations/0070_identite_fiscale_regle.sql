-- Identité fiscale du coach -- RÈGLES (16 novembre 2026, L5, P5.2 ; décor : 0069).
--
-- Ce sont les mentions de la facture que la plateforme émet au nom du coach (docs/domaine.md
-- §3.5) : une valeur fausse ferait une facture fausse, immuable, gardée dix ans. Le serveur
-- refuse donc (identite_fiscale_invalide) :
--   - un SIREN qui n'a pas neuf chiffres, ou dont la clé de contrôle (Luhn) est fausse ;
--   - une adresse ou une commune vide ; un code postal qui n'a pas cinq chiffres ;
--   - un coach assujetti sans taux, ou avec un taux hors de 1 à 1000 pour mille ;
--   - un coach en franchise en base avec un taux.
-- Il ne vérifie pas que le SIREN existe ni qu'il est celui du coach : aucun registre n'est
-- interrogé au jalon 1 (docs/dette.md).

create function public.siren_valide(p_siren text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_total integer := 0;
  v_chiffre integer;
begin
  if p_siren is null or p_siren !~ '^[0-9]{9}$' then
    return false;
  end if;
  -- Luhn : de droite à gauche, un chiffre sur deux est doublé (et réduit de 9 au-delà de 9).
  for i in 1..9 loop
    v_chiffre := substr(p_siren, 10 - i, 1)::integer;
    if i % 2 = 0 then
      v_chiffre := v_chiffre * 2;
      if v_chiffre > 9 then
        v_chiffre := v_chiffre - 9;
      end if;
    end if;
    v_total := v_total + v_chiffre;
  end loop;
  return v_total % 10 = 0;
end;
$$;

revoke execute on function public.siren_valide(text)
  from public, anon, authenticated, service_role;

create or replace function public.enregistrer_identite_fiscale(
  p_siren text,
  p_adresse_ligne text,
  p_code_postal text,
  p_commune text,
  p_regime_tva public.regime_tva_enum,
  p_taux_tva_pour_mille integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_coach_en_espace_coach();
  v_adresse text := nullif(btrim(coalesce(p_adresse_ligne, '')), '');
  v_commune text := nullif(btrim(coalesce(p_commune, '')), '');
begin
  if not public.siren_valide(p_siren)
     or v_adresse is null
     or v_commune is null
     or p_code_postal is null
     or p_code_postal !~ '^[0-9]{5}$'
     or p_regime_tva is null
     or (p_regime_tva = 'assujetti'
         and (p_taux_tva_pour_mille is null or p_taux_tva_pour_mille not between 1 and 1000))
     or (p_regime_tva = 'franchise_en_base' and p_taux_tva_pour_mille is not null) then
    raise exception 'identite_fiscale_invalide';
  end if;

  insert into public.identites_fiscales_coach as i (
    profil_coach_id, siren, adresse_ligne, code_postal, commune, regime_tva, taux_tva_pour_mille
  )
  values (
    v_profil, p_siren, v_adresse, p_code_postal, v_commune, p_regime_tva, p_taux_tva_pour_mille
  )
  on conflict (profil_coach_id) do update
    set siren = excluded.siren,
        adresse_ligne = excluded.adresse_ligne,
        code_postal = excluded.code_postal,
        commune = excluded.commune,
        regime_tva = excluded.regime_tva,
        taux_tva_pour_mille = excluded.taux_tva_pour_mille,
        mise_a_jour_le = now();
end;
$$;

revoke execute on function public.enregistrer_identite_fiscale(
  text, text, text, text, public.regime_tva_enum, integer
) from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_identite_fiscale(
  text, text, text, text, public.regime_tva_enum, integer
) to authenticated;
