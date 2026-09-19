-- Graphie tranchée le 19 septembre 2026 : "My Fav Coach" (F majuscule), celle du logo et de la
-- marque, partout dans le dépôt. 0001_creer_identite.sql est déjà appliquée -- jamais éditée --
-- donc le message du déclencheur des 18 ans se corrige ici, par un simple remplacement de
-- fonction : aucun droit ne change, le trigger existant (avant_ecriture_compte_verifie_age)
-- reste attaché à cette même fonction sans avoir besoin d'être recréé.

create or replace function public.verifier_age_majeur()
returns trigger
language plpgsql
as $$
begin
  if age(new.date_naissance) < interval '18 years' then
    raise exception 'My Fav Coach est reserve aux majeurs : % indique moins de 18 ans.', new.date_naissance
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
