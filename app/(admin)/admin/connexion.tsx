import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { supabaseAdmin } from '@/services/supabase/client-admin';

// L2-10 : écran de connexion dédié à app/(admin)/. Un compte auth.users distinct par
// examinateur (docs/backend.md §9) — jamais un mot de passe partagé. Interface minimale,
// volontairement sans design system mobile (cet écran n'a pas de maquette, docs/ecrans/L2-10.md).
//
// Deux usages : rendu DANS /admin/verification (qui passe `onConnecte`), ou ouvert seul à sa propre
// adresse /admin/connexion — alors, une connexion réussie mène à la file. Trouvé le 11 novembre
// 2026 : ouvert seul, l'écran plantait après la connexion (`onConnecte is not a function`).
export default function ConnexionAdmin({ onConnecte }: { onConnecte?: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  async function surValider() {
    setErreur(null);
    const { error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: motDePasse,
    });
    if (error) {
      setErreur('Identifiants refusés.');
      return;
    }
    if (onConnecte) onConnecte();
    else router.replace('/admin/verification');
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Back-office — vérification</Text>
      <TextInput
        placeholder="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Adresse e-mail"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      <TextInput
        placeholder="Mot de passe"
        value={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry
        accessibilityLabel="Mot de passe"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      {erreur ? <Text style={{ color: 'red' }}>{erreur}</Text> : null}
      <Text onPress={() => void surValider()} accessibilityRole="button" style={{ padding: 10 }}>
        Se connecter
      </Text>
    </View>
  );
}
