// Écran 24 « Mon compte et réglages » (docs/ecrans/L1-07-compte-reglages.md). Le contenu réel
// vit dans src/fonctionnalites/compte/ecran-compte.tsx : le MÊME écran sert les deux espaces
// (app/(coach)/moi.tsx le réexporte à l'identique), seul l'en-tête change de profil.
export { EcranCompte as default } from '@/fonctionnalites/compte/ecran-compte';
