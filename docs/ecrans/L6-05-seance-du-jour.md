# L6-05 · Séance du jour (05)

**Lot** L6 · **Rôle** client · **Route** `app/(client)/seance/[seanceProgrammeeId].tsx`, et le
bloc « Ta séance du jour » de l'accueil client (`app/(client)/(tabs)/accueil.tsx`)
**Référence visuelle** `maquettes/MyFavCoach-Client_dc.html`, `data-screen-label="05 Seance du
jour"` ; la carte « Ta séance du jour » de `maquettes/MyFavCoach-System_dc.html` (écran 01, bloc
« Cartes »).

Fiche écrite par Claude le 17 novembre 2026, sous le mandat du 15 novembre : **tout ce qui n'est
pas dans la maquette est à relire**. Plan et décisions : `docs/prompts/L6.md`.

---

## Raison d'être

Le client fait sa séance, exercice par exercice, et dit ce qu'il a fait. C'est ce que le coach
lira ensuite (L7).

## Le bloc de l'accueil

Si le client a une séance programmée aujourd'hui (chez un coach auquel il a accès) : la carte
« Ta séance du jour » — titre, « {n} exercices · {durée} min », « avec {prénom nom du coach} »,
bouton « Commencer » (ou « Reprendre » si elle est en cours, « Faite » en libellé si elle est
faite). Sinon, pas de carte : l'absence est l'état honnête, aucune carte de repli.

## L'écran de la séance

Fond sombre de la maquette (thème forcé sombre, lu explicitement : `CLAUDE.md` §5).

1. En-tête : temps écoulé depuis le démarrage (« 18:42 écoulées »), titre de la séance,
   « Exercice {i} sur {n} · il te reste ~{m} min ».
2. La liste des exercices : terminés repliés (nom et « {séries} × {répétitions} »), l'exercice en
   cours déplié, les suivants repliés.
3. L'exercice en cours : son média (« Démo » ouvre l'URL signée), sa consigne, et une ligne par
   série : « Série {k} », répétitions et charge pré-remplies d'après le programme, modifiables ;
   « Valider » enregistre la série.
4. Pied : « Exercice suivant » ; au dernier, « Terminer la séance ».

Avant le premier exercice, si la séance n'est pas démarrée : « Commencer la séance » la démarre.

## Fin de séance

Une feuille : « Comment s'est passée ta séance ? » — avec le consentement santé, le ressenti
d'effort de 1 à 10 (« 1 · très facile » … « 10 · maximal ») ; sans lui, pas de question. Un
commentaire facultatif (« Un mot pour {prénom du coach} ? »). « Enregistrer » : la séance passe à
« faite ». Retour à l'accueil.

## Règles

- Tout vient du serveur et s'écrit par lui (démarrage, séries, validation, ressenti).
- Le ressenti n'est jamais dans une adresse, un journal, ni gardé sur l'appareil au-delà de
  l'écran.
- Une séance `manquee` ou `partielle` depuis 7 jours au plus peut être faite : elle est marquée
  « rattrapée ». Au-delà : « Cette séance ne peut plus être rattrapée. ».
- Sans accès (abonnement en pause, suspendu, terminé) : « Ta séance n'est pas accessible pour
  l'instant. » avec la raison rendue par le serveur.

## États

Chargement : squelette. Erreur : `EtatErreur`. Séance introuvable : « Cette séance est
introuvable. ».

## Ce qui a été inventé pour cette fiche

La feuille de fin de séance, l'échelle du ressenti, « Commencer la séance », les textes de
rattrapage et d'accès. Le chronomètre de repos (« Repos conseillé 90 s », « 1:12 ») de la
maquette est écarté au jalon 1 : il demande un minuteur qui tourne écran éteint.

## Critères d'acceptation

1. Un abonné voit sur son accueil la séance affectée pour aujourd'hui, la commence, valide ses
   séries, la termine : le serveur la marque « faite » avec les valeurs saisies.
2. Sans consentement santé, aucune question de ressenti ; une valeur envoyée quand même est
   refusée par le serveur (banc).
3. Un client ne lit ni n'écrit la séance d'un autre (banc, deux sens) ; un abonnement en pause
   coupe l'accès.
4. Galerie et corpus d'accessibilité ; clos dans le navigateur sur la base de dev.
5. `npm run verif` passe.
