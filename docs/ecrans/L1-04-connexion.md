# L1-04 · Connexion et mot de passe oublié

**Lot** L1 · **Rôle** aucun (public) · **Routes** `app/(public)/connexion.tsx`,
`app/(public)/mot-de-passe-oublie.tsx`, `app/(public)/nouveau-mot-de-passe.tsx`
**Référence visuelle** **aucune — écrans absents du dossier de design, conçus ici**

---

## Raison d'être

Trois écrans que personne ne dessine et que tout le monde utilise. Ils partagent la mise en
page de L1-02 : même en-tête, mêmes champs, même pied fixe. Les réinventer serait la première
fissure dans la cohérence du produit.

---

## Connexion

Titre : « Content de te revoir. »
Deux champs : adresse e-mail, mot de passe (bouton œil).
Lien discret sous le mot de passe : « Mot de passe oublié ».
Pied fixe : bouton primaire « Se connecter ».
Sous le pied : « Pas encore de compte · Créer un compte ».

**Un seul message d'échec** : « Adresse ou mot de passe incorrect. » Quelle que soit la cause
réelle. Ne jamais distinguer les deux : ce serait publier la liste des comptes existants.

Après trois échecs consécutifs sur le même appareil, ajouter sous le message : « Tu peux
réinitialiser ton mot de passe. » — une aide, pas un blocage.

---

## Mot de passe oublié

Un champ, une action. Titre : « On te renvoie une clé. »

**Réponse constante** : quelle que soit l'adresse saisie, l'écran suivant affiche « Si un compte
existe avec cette adresse, le lien est parti. » Aucune distinction, aucune animation
différente, aucun délai différent.

---

## Nouveau mot de passe

Atteint par lien profond `myfavcoach://auth/mot-de-passe`. Un champ (10 caractères minimum), un
bouton. Après succès : **toutes les autres sessions du compte sont révoquées**, et l'utilisateur
arrive dans son espace, connecté.

« Révoquées » — vérifié contre la base réelle (P1.9), pas supposé : un jeton d'accès déjà émis
est un JWT auto-vérifié, jamais recontrôlé en base à chaque requête. Une session ouverte
ailleurs ne peut **plus jamais se reconnecter** dès cet instant (son jeton de rafraîchissement
est invalidé immédiatement), mais son jeton d'accès EN COURS reste valable jusqu'à sa propre
expiration — `jwt_expiry` de `supabase/config.toml`, 3600 s (1 h) au moment où ceci est écrit.
Ce n'est pas « ne peut plus rien lire à l'instant » : c'est « ne peut plus jamais obtenir un
nouveau jeton », avec un résidu de lecture possible sur l'ancien jeton pendant au plus une
heure. La distinction compte : ne jamais promettre à l'écran ou à l'utilisateur une coupure
immédiate que le mécanisme ne fournit pas.

---

## États

| État | Comportement |
|---|---|
| Normal | Bouton actif dès les champs remplis |
| Chargement | Bouton en attente, champs en lecture seule |
| Échec d'identifiants | Message unique sous le formulaire, les deux champs conservent leur valeur, le focus va au mot de passe |
| Trop de tentatives | Message du service traduit : « Trop d'essais. Réessaie dans quelques minutes. » |
| Lien de réinitialisation expiré | « Ce lien a expiré » + action « M'en renvoyer un » |

---

## Règles

- Le compte non vérifié qui se connecte n'est pas rejeté : il arrive sur **L1-03**, pas sur un
  message d'erreur. Un utilisateur qui a créé son compte hier et cliqué au mauvais endroit doit
  retrouver son chemin, pas un mur.
- La limitation de débit est portée par le service, pas par l'application. L'application traduit
  la réponse, elle ne compte rien elle-même.
- Ces trois écrans **réutilisent** les composants de L1-02 : si un champ diverge visuellement,
  c'est une erreur de découpage, pas une variante.
- Aucun stockage du dernier e-mail saisi : pas de « pré-remplissage utile » qui expose une
  adresse sur un appareil partagé.

---

## Critères d'acceptation

1. Adresse inconnue et mot de passe faux produisent **exactement la même chaîne** — testé par
   comparaison stricte des deux rendus.
2. Le parcours « oublié » affiche le même écran de confirmation pour une adresse existante et
   pour une adresse inventée — même test comparatif.
3. Un compte non vérifié qui se connecte arrive sur L1-03.
4. Après changement de mot de passe, une session ouverte ailleurs ne peut plus jamais obtenir un
   nouveau jeton d'accès (son jeton de rafraîchissement est immédiatement invalidé) — vérifié
   contre la base réelle, pas par un simulacre. Son jeton d'accès déjà émis, lui, reste valable
   jusqu'à sa propre expiration (résidu de lecture possible, borné dans le temps — voir « Nouveau
   mot de passe » ci-dessus) : ce résidu n'est PAS ce que ce critère prouve, seule l'impossibilité
   de rafraîchir l'est.
5. Les trois écrans partagent les mêmes composants de champ et de pied : un test vérifie
   qu'aucun style de champ n'est redéfini localement.
6. Le lecteur d'écran annonce le message d'échec à son apparition sans voler le focus.
7. Surfaces nouvelles dans la galerie, **exercées en clair et en sombre**.
8. `npm run verif` passe.
