-- Nom et poids d'une pièce de vérification -- RÈGLE (12 novembre 2026, voir 0056).
--
-- Le coach écrit le nom et le poids avec la ligne de sa pièce, et les relit : même découpe
-- colonne par colonne que 0012 (chemin_stockage reste hors de toute lecture). Les politiques de
-- 0012 s'appliquent telles quelles : l'insertion par le propriétaire en espace coach, la lecture
-- par le seul propriétaire. L'examinateur les reçoit par pieces_verification_pour_examinateur()
-- (0013), qui rend la ligne entière.
grant insert (nom_fichier, taille_octets) on public.pieces_verification to authenticated;
grant select (nom_fichier, taille_octets) on public.pieces_verification to authenticated;
