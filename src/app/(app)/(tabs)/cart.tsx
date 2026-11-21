import { randomUUID } from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, money, type CartItem } from '@/features/api';
import { useSession } from '@/features/session';
import { Button, Feedback, Page, styles, useAction, useData } from '@/features/ui';

export default function Cart() {
  const { call, session } = useSession();
  const state = useData(useCallback(() => call<CartItem[]>('cart'), [call]));
  const action = useAction();
  const [notice, setNotice] = useState('');
  const operation = useRef<string | null>(null);
  const [retry, setRetry] = useState(false);
  const cart = state.data || [];
  const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  function setQuantity(item: CartItem, quantity: number) {
    void action.run(async () => {
      setNotice('');
      await call('cart_set', { product_id: item.id, quantity });
      await state.refresh();
    });
  }

  if (session?.role !== 'penitip') return <Page title="Keranjang"><Text style={styles.text}>Buka keranjang sebagai Penitip.</Text></Page>;

  return <SafeAreaView edges={['top']} style={styles.page}><Page title="Keranjang">
    <Feedback loading={state.loading || action.busy} error={action.error || state.error} />
    {!!state.error && <Button title="Muat ulang" onPress={() => void state.refresh()} />}
    {!!notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
    {state.data && !cart.length && <Text style={styles.muted}>Keranjang masih kosong.</Text>}
    {cart.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.heading}>{item.name}</Text>
      <Text style={styles.muted}>{item.trip_name} · Stok {item.stock}</Text>
      <Text style={styles.text}>{item.quantity} × {money(item.price)}</Text>
      <View style={styles.row}>
        <Button title="Kurangi" secondary disabled={action.busy || retry || item.quantity <= 1} onPress={() => setQuantity(item, Number(item.quantity) - 1)} />
        <Button title="Tambah" secondary disabled={action.busy || retry || Number(item.quantity) >= Number(item.stock)} onPress={() => setQuantity(item, Number(item.quantity) + 1)} />
        <Button title="Hapus" secondary disabled={action.busy || retry} onPress={() => setQuantity(item, 0)} />
      </View>
    </View>)}
    {(cart.length > 0 || retry) && <View style={styles.card}>
      <Text style={styles.heading}>Total {money(total)}</Text>
      <Text style={styles.muted}>Pembayaran ditahan sampai barang diterima.</Text>
      <Button title={retry ? 'Coba checkout yang sama' : 'Bayar dengan saldo'} disabled={action.busy || state.loading}
        onPress={() => void action.run(async () => {
          setNotice('');
          operation.current ||= randomUUID();
          let result;
          try { result = await call<{ checkout_id: number }>('checkout', { operation_key: operation.current }); }
          catch (error) {
            const uncertain = error instanceof ApiError && (error.status === 0 || error.status >= 500);
            setRetry(uncertain);
            if (!uncertain) operation.current = null;
            throw error;
          }
          operation.current = null;
          setRetry(false);
          setNotice('Checkout #' + result.checkout_id + ' berhasil.');
          await state.refresh();
        })} />
    </View>}
  </Page></SafeAreaView>;
}
