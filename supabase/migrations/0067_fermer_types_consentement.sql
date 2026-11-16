-- consentements.type : la liste est fermée (15 novembre 2026, docs/dette.md ; docs/domaine.md
-- §3.12 : donneesSante, notificationsPush, communicationsCommerciales). Jusqu'ici, un texte libre :
-- rien n'empêchait d'écrire « donnees_sante », que la vue consentements_courants aurait rangé
-- comme un quatrième type, sans effet sur la protection du poids (0004 lit « donneesSante ») et
-- sans que rien ne le dise. Même durcissement que pieces_verification_type_connu (0053).
--
-- Vérifié d'abord contre le projet de développement : deux types présents, tous deux dans la
-- liste (donneesSante, communicationsCommerciales). La contrainte ne rejette aucune ligne
-- existante ; sur une base qui en porterait une, la migration échouerait en le disant, ce qui est
-- voulu.
alter table public.consentements
  add constraint consentements_type_connu
  check (type in ('donneesSante', 'notificationsPush', 'communicationsCommerciales'));
