import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, baseUrl, money, type Notice, type Wallet } from '@/features/api';
import { useSession } from '@/features/session';
import { numberField } from '@/features/trip-forms';
import { Button, Feedback, Field, Page, styles, useAction, useData } from '@/features/ui';

export default function Account() {
  const { call, session, changeRole, logout } = useSession();
  const wallet = useData(useCallback(() => call<Wallet>('wallet'), [call]));
  const inbox = useData(useCallback(() => call<Notice[]>('inbox'), [call]), 15_000);
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState('');
  const action = useAction();
  const pendingKey = 'jastipgo.topup:' + baseUrl + ':' + session?.user.id;

  async function topup() {
    setNotice('');
    let operation = await AsyncStorage.getItem(pendingKey).then(raw => raw ? JSON.parse(raw) as { key: string; amount: number } : null);
    const retrying = !!operation;
    if (!operation) {
      operation = { key: randomUUID(), amount: numberField(amount, 'Nominal', 1000, 10000000) };
      await AsyncStorage.setItem(pendingKey, JSON.stringify(operation));
    }
    try {
      await call('topup', { amount: operation.amount, operation_key: operation.key });
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
        await AsyncStorage.removeItem(pendingKey);
      }
      throw error;
    }
    await AsyncStorage.removeItem(pendingKey);
    setAmount('');
    setNotice((retrying ? 'Top-up sebelumnya dikonfirmasi ' : 'Top-up berhasil ') + money(operation.amount) + '.');
    await wallet.refresh();
  }

  return <SafeAreaView edges={['top']} style={styles.page}><Page title="Akun">
    <View style={styles.card}>
      <Text style={styles.heading}>{session?.user.name}</Text>
      <Text style={styles.muted}>{session?.user.email}</Text>
      <Text style={styles.text}>Peran aktif {session?.role === 'jastiper' ? 'Jastiper' : 'Penitip'}</Text>
      <View style={styles.row}>
        <Button title={session?.role === 'jastiper' ? 'Pindah ke Penitip' : 'Pindah ke Jastiper'} disabled={action.busy}
          onPress={() => void action.run(() => changeRole(session?.role === 'jastiper' ? 'penitip' : 'jastiper'))} />
        <Button title="Keluar" secondary disabled={action.busy} onPress={() => void action.run(logout)} />
      </View>
    </View>
    <Feedback loading={wallet.loading || action.busy} error={action.error || wallet.error} />
    {!!wallet.error && <Button title="Muat ulang saldo" onPress={() => void wallet.refresh()} />}
    <View style={styles.card}>
      <Text style={styles.heading}>Saldo {wallet.data ? money(wallet.data.balance) : ''}</Text>
      <Field label="Nominal top-up (Rp)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Minimal Rp1.000" />
      <Button title="Top-up saldo" disabled={action.busy} onPress={() => void action.run(topup)} />
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
    </View>
    <Text style={styles.heading}>Riwayat saldo</Text>
    {wallet.data?.ledger.length === 0 && <Text style={styles.muted}>Belum ada transaksi.</Text>}
    {wallet.data?.ledger.map(entry => <View key={entry.id} style={styles.card}>
      <Text style={styles.text}>{entry.description} · {money(entry.amount)}</Text>
      <Text style={styles.muted}>{entry.created_at}</Text>
    </View>)}
    <Text style={styles.heading}>Kotak masuk</Text>
    <Feedback loading={inbox.loading} error={inbox.error} />
    {!!inbox.error && <Button title="Muat ulang pesan" onPress={() => void inbox.refresh()} />}
    {inbox.data?.some(item => !Number(item.is_read)) && <Button title="Tandai semua dibaca" secondary disabled={action.busy}
      onPress={() => void action.run(async () => { await call('read_inbox'); await inbox.refresh(); })} />}
    {inbox.data?.length === 0 && <Text style={styles.muted}>Belum ada pesan.</Text>}
    {inbox.data?.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.text}>{item.message}</Text>
      <Text style={styles.muted}>{item.created_at}{Number(item.is_read) ? '' : ' · Baru'}</Text>
    </View>)}
  </Page></SafeAreaView>;
}
