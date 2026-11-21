import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { money, type CartItem, type Product } from '@/features/api';
import { useSession } from '@/features/session';
import { numberField } from '@/features/trip-forms';
import { Button, Feedback, Field, Page, Photo, styles, useAction, useData } from '@/features/ui';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { call, session } = useSession();
  const state = useData(useCallback(() => call<Product>('product', { id: Number(id) }), [call, id]));
  const action = useAction();
  const [quantity, setQuantity] = useState('1');
  const [notice, setNotice] = useState('');
  const product = state.data;
  return <Page title={product?.name || 'Barang'}>
    <Feedback error={state.error || action.error} loading={state.loading || action.busy} />
    {!!state.error && <Button title="Muat ulang" onPress={() => void state.refresh()} />}
    {product && <>
      <Photo path={product.photo} label={product.name} />
      <Text style={styles.heading}>{money(product.price)} · Stok {product.stock}</Text>
      <Text style={styles.text}>{product.description}</Text>
      <Text style={styles.muted}>{product.categories.map(category => category.name).join(' · ')}</Text>
      <View style={styles.row}>
        <Button title={product.trip_name} secondary onPress={() => router.push({ pathname: '/trip/[id]', params: { id: product.trip_id } })} />
        <Button title={Number(product.favorite) ? 'Hapus favorit' : 'Simpan favorit'} secondary disabled={action.busy}
          onPress={() => void action.run(async () => {
            await call('favorite', { product_id: product.id, enabled: !Number(product.favorite) });
            await state.refresh();
          })} />
      </View>
      {session?.role === 'penitip' && Number(session.user.id) !== Number(product.owner_id) && <View style={styles.card}>
        <Field label="Jumlah tambahan" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
        <Button title="Tambahkan ke keranjang" disabled={action.busy || product.stock < 1} onPress={() => void action.run(async () => {
          setNotice('');
          const amount = numberField(quantity, 'Jumlah', 1, Number(product.stock));
          const cart = await call<CartItem[]>('cart');
          const existing = cart.find(item => Number(item.id) === Number(product.id));
          await call('cart_set', { product_id: product.id, quantity: Number(existing?.quantity || 0) + amount });
          setNotice('Barang ditambahkan ke keranjang.');
        })} />
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
      </View>}
      <Text style={styles.heading}>Ulasan pembeli</Text>
      {product.reviews?.length ? product.reviews.map(review => <View key={review.id} style={styles.card}>
        <Text style={styles.text}>{review.buyer_name} · {review.rating}/5</Text>
        <Text style={styles.muted}>{review.comment}</Text>
      </View>) : <Text style={styles.muted}>Belum ada ulasan.</Text>}
    </>}
  </Page>;
}
