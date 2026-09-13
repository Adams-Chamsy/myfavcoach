// Écran 24 « Mon compte et réglages » côté coach (docs/ecrans/L1-07-compte-reglages.md).
// Même route relative « moi » que app/(client)/moi.tsx, même écran : le contenu réel vit dans
// src/fonctionnalites/compte/ecran-compte.tsx. Cette route n'est pas un onglet coach (la barre
// n'en a que quatre + « Créer », docs/ecrans/L0-02) — elle est atteinte par l'avatar et la
// feuille de bascule, et déclarée `href: null` dans app/(coach)/_layout.tsx.
export { EcranCompte as default } from '@/fonctionnalites/compte/ecran-compte';
