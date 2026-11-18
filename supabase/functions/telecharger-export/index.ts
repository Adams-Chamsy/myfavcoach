import { servirExport } from '../_partage/export-donnees.ts';
import { clientServeur } from '../_partage/postgres.ts';

Deno.serve((requete) =>
  servirExport(requete, async (jeton) => {
    const { data, error } = await clientServeur().rpc('telecharger_export', { p_jeton: jeton });
    if (error) throw error;
    return typeof data === 'string' ? data : null;
  }),
);
