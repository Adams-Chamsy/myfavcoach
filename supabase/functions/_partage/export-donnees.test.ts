import { strictEqual as assertEquals } from 'node:assert';
import { servirExport } from './export-donnees.ts';

const jeton = '7f73ea5a-9f58-490a-a9f8-3695f431a2bf';
const url = 'https://exemple.invalid/functions/v1/telecharger-export';

Deno.test('livre le JSON en pièce jointe privée avec le jeton', async () => {
  const fichier = '{"version":1}';
  const reponse = await servirExport(new Request(`${url}?jeton=${jeton}`), (recu) => {
    assertEquals(recu, jeton);
    return Promise.resolve(fichier);
  });
  assertEquals(reponse.status, 200);
  assertEquals(reponse.headers.get('Cache-Control'), 'private, no-store');
  assertEquals(
    reponse.headers.get('Content-Disposition'),
    'attachment; filename="myfavcoach-donnees.json"',
  );
  assertEquals(await reponse.text(), fichier);
});

Deno.test('refuse les requêtes mal formées sans lire la base', async () => {
  const lire = () => {
    throw new Error('lecture inattendue');
  };
  assertEquals((await servirExport(new Request(url, { method: 'POST' }), lire)).status, 405);
  assertEquals((await servirExport(new Request(url), lire)).status, 404);
  assertEquals((await servirExport(new Request(`${url}?jeton=incorrect`), lire)).status, 404);
});

Deno.test('un fichier expiré ou introuvable ne retourne aucune donnée', async () => {
  const reponse = await servirExport(new Request(`${url}?jeton=${jeton}`), () =>
    Promise.resolve(null),
  );
  assertEquals(reponse.status, 404);
  assertEquals(await reponse.text(), '');
});

Deno.test('une panne ne révèle aucun détail interne', async () => {
  const reponse = await servirExport(new Request(`${url}?jeton=${jeton}`), () =>
    Promise.reject(new Error('détail interne')),
  );
  assertEquals(reponse.status, 503);
  assertEquals(await reponse.text(), '');
});
