import { creerFauxPortAuth } from './faux';

const MAJEUR = '2000-01-01';

// Format en LOCAL, jamais `.toISOString().slice(0, 10)` : cette dernière convertit en UTC, ce
// qui bascule sur la veille dès que l'heure locale est entre minuit et l'avance du fuseau
// (ex. 01h du matin heure de Paris, UTC+2, vaut encore la veille en UTC) — piège trouvé en
// écrivant ce test même, pas hypothétique. Le vrai sélecteur natif (L1-02) raisonne en local.
function versDateLocale(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

describe('creerFauxPortAuth', () => {
  it('inscription : succès pour un majeur', async () => {
    const port = creerFauxPortAuth();
    const resultat = await port.inscrire('camille@exemple.fr', 'un-mot-de-passe', MAJEUR);
    expect(resultat).toEqual({ succes: true });
  });

  // docs/ecrans/L1-02 : "Moins de 18 ans" — l'écran doit pouvoir tester ce refus sans base.
  it('inscription : un mineur exact (17 ans et 364 jours) est refusé', async () => {
    const port = creerFauxPortAuth();
    const hier = new Date();
    hier.setFullYear(hier.getFullYear() - 18);
    hier.setDate(hier.getDate() + 1); // 17 ans et 364 jours, pas encore 18.
    const dateNaissance = versDateLocale(hier);

    const resultat = await port.inscrire('mineur@exemple.fr', 'un-mot-de-passe', dateNaissance);

    expect(resultat).toEqual({
      succes: false,
      erreur: { code: 'age_insuffisant', message: 'My fav Coach est réservé aux majeurs.' },
    });
  });

  it('inscription : 18 ans exactement est accepté', async () => {
    const port = creerFauxPortAuth();
    const aujourdHui = new Date();
    aujourdHui.setFullYear(aujourdHui.getFullYear() - 18);
    const dateNaissance = versDateLocale(aujourdHui);

    const resultat = await port.inscrire(
      'majeur-pile@exemple.fr',
      'un-mot-de-passe',
      dateNaissance,
    );

    expect(resultat).toEqual({ succes: true });
  });

  // docs/ecrans/L1-02 : "Aucune énumération de comptes."
  it('inscription : une adresse déjà prise rend exactement la même réponse qu’une adresse nouvelle, sans écraser le compte', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'premier-mot-de-passe', MAJEUR);

    const secondeTentative = await port.inscrire(
      'camille@exemple.fr',
      'AUTRE-mot-de-passe',
      MAJEUR,
    );
    expect(secondeTentative).toEqual({ succes: true });

    // Preuve indépendante : le mot de passe d'origine reste le seul valide.
    port.verifierEmailPourTest('camille@exemple.fr');
    const connexionAvecOriginal = await port.connecter(
      'camille@exemple.fr',
      'premier-mot-de-passe',
    );
    expect(connexionAvecOriginal.type).toBe('connecte');
  });

  it('connexion : identifiants faux, adresse inconnue ou mot de passe faux rendent la même erreur', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');

    const adresseInconnue = await port.connecter('personne@exemple.fr', 'peu-importe');
    const mauvaisMotDePasse = await port.connecter('camille@exemple.fr', 'mauvais');

    expect(adresseInconnue).toEqual(mauvaisMotDePasse);
    expect(adresseInconnue).toEqual({
      type: 'echec',
      erreur: { code: 'identifiants_invalides', message: 'Adresse ou mot de passe incorrect.' },
    });
  });

  // docs/ecrans/L1-04 : "n'est pas rejeté : il arrive sur L1-03, pas sur un message d'erreur."
  it('connexion : un compte non vérifié rend une troisième issue, ni succès ni échec', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);

    const resultat = await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    expect(resultat).toEqual({ type: 'email_non_verifie' });
  });

  it('connexion : succès après vérification, rend une session', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');

    const resultat = await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    expect(resultat.type).toBe('connecte');
    if (resultat.type === 'connecte') {
      expect(resultat.session.email).toBe('camille@exemple.fr');
      expect(resultat.session.emailVerifie).toBe(true);
    }
  });

  it('connexion : la limite de débit se déclenche après trop d’échecs, même avec le bon mot de passe ensuite', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');

    for (let i = 0; i < 10; i += 1) {
      await port.connecter('camille@exemple.fr', 'mauvais');
    }

    const resultat = await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    expect(resultat).toEqual({
      type: 'echec',
      erreur: { code: 'limite_debit', message: 'Trop d’essais. Réessaie dans quelques minutes.' },
    });
  });

  it('deconnecter puis sessionCourante rend null', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');
    await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    await port.deconnecter();

    expect(await port.sessionCourante()).toBeNull();
  });

  it('demanderReinitialisation et renvoyerVerification rendent une réponse constante', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);

    const adresseExistante = await port.demanderReinitialisation('camille@exemple.fr');
    const adresseInventee = await port.demanderReinitialisation('personne@exemple.fr');

    expect(adresseExistante).toEqual(adresseInventee);
    expect(adresseExistante).toEqual({ succes: true });
  });

  it('changerMotDePasse sans session active est une erreur de programmation, pas un échec utilisateur', async () => {
    const port = creerFauxPortAuth();
    await expect(port.changerMotDePasse('nouveau')).rejects.toThrow(/session active/);
  });

  it('surChangementDeSession notifie connexion et déconnexion, puis se désabonne', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    port.verifierEmailPourTest('camille@exemple.fr');

    const notifications: unknown[] = [];
    const arreter = port.surChangementDeSession((session) => notifications.push(session));

    await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');
    await port.deconnecter();
    arreter();
    await port.connecter('camille@exemple.fr', 'bon-mot-de-passe');

    expect(notifications).toHaveLength(2);
    expect((notifications[0] as { email: string }).email).toBe('camille@exemple.fr');
    expect(notifications[1]).toBeNull();
  });

  // docs/ecrans/L1-03-verification-email.md : le lien profond confirme ET établit la session.
  it('etablirSessionDepuisLien confirme l’adresse et établit la session', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    const lien = port.lienVerificationPourTest('camille@exemple.fr');

    const resultat = await port.etablirSessionDepuisLien(lien);

    expect(resultat).toEqual({ succes: true });
    const session = await port.sessionCourante();
    expect(session?.email).toBe('camille@exemple.fr');
    expect(session?.emailVerifie).toBe(true);
  });

  it('etablirSessionDepuisLien : un lien périmé rend l’erreur dédiée, sans établir de session', async () => {
    const port = creerFauxPortAuth();
    await port.inscrire('camille@exemple.fr', 'bon-mot-de-passe', MAJEUR);
    const lien = port.lienVerificationPourTest('camille@exemple.fr');
    port.expirerLienPourTest('camille@exemple.fr');

    const resultat = await port.etablirSessionDepuisLien(lien);

    expect(resultat).toEqual({
      succes: false,
      erreur: { code: 'lien_expire', message: 'Ce lien a expiré.' },
    });
    expect(await port.sessionCourante()).toBeNull();
  });

  it('etablirSessionDepuisLien : un code inconnu rend une erreur générique', async () => {
    const port = creerFauxPortAuth();

    const resultat = await port.etablirSessionDepuisLien('myfavcoach://auth/rappel?code=inconnu');

    expect(resultat).toEqual({
      succes: false,
      erreur: { code: 'serveur', message: 'On a un souci de notre côté. Ce n’est pas toi.' },
    });
  });
});
