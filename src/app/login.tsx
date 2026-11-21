import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/features/session';
import { Button, Feedback, Field, Page, styles, useAction } from '@/features/ui';

export default function Login() {
  const { authenticate } = useSession();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();
  return <SafeAreaView style={styles.page}><Page title="JasTipGo">
    <Text style={styles.muted}>Titip barang dari trip pilihanmu.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>{register ? 'Daftar akun' : 'Masuk'}</Text>
      {register && <Field label="Nama" value={name} onChangeText={setName} maxLength={100} />}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
      <Field label="Kata sandi" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      <Feedback error={action.error} loading={action.busy} />
      <Button title={register ? 'Daftar' : 'Masuk'} disabled={action.busy} onPress={() => void action.run(async () => {
        if (!email.trim() || !password || (register && !name.trim())) throw new Error('Lengkapi semua kolom.');
        if (register && password.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
        await authenticate(register, { email: email.trim(), password, ...(register ? { name: name.trim() } : {}) });
      })} />
      <Button title={register ? 'Sudah memiliki akun? Masuk' : 'Buat akun'} secondary disabled={action.busy} onPress={() => setRegister(!register)} />
    </View>
  </Page></SafeAreaView>;
}
