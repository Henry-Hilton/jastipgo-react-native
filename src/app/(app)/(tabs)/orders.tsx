import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { money, statusLabels, type Order } from '@/features/api';
import { useSession } from '@/features/session';
import { numberField } from '@/features/trip-forms';
import { Button, Feedback, Field, Page, styles, useAction, useData } from '@/features/ui';

export default function Orders() {
  const { call, session } = useSession();
  const seller = session?.role === 'jastiper';
  const state = useData(useCallback(() => call<Order[]>('orders'), [call]));
  const action = useAction();
  const [review, setReview] = useState<number>();
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  return <SafeAreaView edges={['top']} style={styles.page}><Page title={seller ? 'Pesanan masuk' : 'Pesanan saya'}>
    <Feedback loading={state.loading || action.busy} error={action.error || state.error} />
    {!!state.error && <Button title="Muat ulang" onPress={() => void state.refresh()} />}
    {state.data?.length === 0 && <Text style={styles.muted}>Belum ada pesanan.</Text>}
    {state.data?.map(order => {
      const next = seller ? ({ paid: 'purchased', purchased: 'delivered' } as Record<string, string>)[order.status]
        : order.status === 'delivered' ? 'completed' : undefined;
      return <View key={order.id} style={styles.card}>
        <Text style={styles.heading}>#{order.id} · {order.trip_name}</Text>
        <Text style={styles.muted}>{seller ? order.buyer_name : order.seller_name} · {statusLabels[order.status]}</Text>
        {order.items.map(item => <Text key={item.id} style={styles.text}>{item.quantity} × {item.name} · {money(item.price)}</Text>)}
        <Text style={styles.heading}>{money(order.total)}</Text>
        {next && <Button title={next === 'completed' ? 'Konfirmasi diterima' : next === 'purchased' ? 'Tandai sudah dibeli' : 'Tandai diserahkan'}
          disabled={action.busy} onPress={() => void action.run(async () => {
            await call('order_status', { id: order.id, status: next });
            await state.refresh();
          })} />}
        {!seller && order.status === 'completed' && (order.rating
          ? <Text style={styles.muted}>Ulasan kamu {order.rating}/5</Text>
          : review === order.id ? <>
            <Field label="Nilai (1–5)" value={rating} onChangeText={setRating} keyboardType="number-pad" />
            <Field label="Ulasan" value={comment} onChangeText={setComment} maxLength={1000} multiline />
            <Button title="Kirim ulasan" disabled={action.busy} onPress={() => void action.run(async () => {
              if (!comment.trim()) throw new Error('Tulis ulasan terlebih dahulu.');
              await call('review', { order_id: order.id, rating: numberField(rating, 'Nilai', 1, 5), comment: comment.trim() });
              setReview(undefined);
              await state.refresh();
            })} />
            <Button title="Batal" secondary disabled={action.busy} onPress={() => setReview(undefined)} />
          </> : <Button title="Tulis ulasan" secondary disabled={action.busy} onPress={() => {
            setRating('5'); setComment(''); setReview(order.id);
          }} />)}
      </View>;
    })}
  </Page></SafeAreaView>;
}
