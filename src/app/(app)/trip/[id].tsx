import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { money, statusLabels, type Category, type Product, type Request, type Trip } from '@/features/api';
import CheckinMap from '@/features/checkin-map';
import { ProductGrid } from '@/features/products';
import { useSession } from '@/features/session';
import { CheckinForm, ProductForm, RequestForm, TripForm } from '@/features/trip-forms';
import { Button, Feedback, Page, Photo, styles, useAction, useData } from '@/features/ui';

type Edit = { kind: 'trip' } | { kind: 'product'; product?: Product } | { kind: 'approval'; request: Request };

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, call } = useSession();
  const state = useData(useCallback(() => call<Trip>('trip', { id: Number(id) }), [call, id]), 15_000);
  const categories = useData(useCallback(() => call<Category[]>('categories'), [call]));
  const action = useAction();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [selected, setSelected] = useState<number>();
  const trip = state.data;
  const owner = !!trip && Number(trip.owner_id) === Number(session?.user.id);
  const manage = owner && session?.role === 'jastiper';
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const active = !!trip && trip.status !== 'finished' && trip.return_date >= today;
  const duringTrip = active && trip.departure <= today;
  const point = trip?.checkins.find(item => item.id === selected) || trip?.checkins[0];
  const done = async () => { setEdit(null); await state.refresh(true); };
  return <Page title={trip?.name || 'Trip'}>
    <Feedback error={state.error || action.error} loading={state.loading || action.busy} />
    {!!state.error && <Button title="Muat ulang" onPress={() => void state.refresh()} />}
    {trip && <>
      <View style={styles.card}>
        <Text style={styles.heading}>{trip.destination}</Text>
        <Text style={styles.text}>{trip.departure} s.d. {trip.return_date}</Text>
        <Text style={styles.muted}>{trip.owner_name} · {statusLabels[trip.status]}</Text>
        {manage && <View style={styles.row}>
          {active && <Button title="Edit trip" secondary disabled={!!edit} onPress={() => setEdit({ kind: 'trip' })} />}
          {(trip.status === 'live' || (duringTrip && trip.status === 'open')) && <Button
            title={trip.status === 'open' ? 'Mulai live trip' : 'Selesaikan trip'} secondary disabled={action.busy}
            onPress={() => void action.run(async () => {
              await call('trip_status', { id: trip.id, status: trip.status === 'open' ? 'live' : 'finished' });
              await state.refresh(true);
            })} />}
        </View>}
      </View>
      {edit?.kind === 'trip' && <TripForm trip={trip} done={done} cancel={() => setEdit(null)} />}
      <Text style={styles.heading}>Barang dalam trip</Text>
      {manage && active && <View style={{ gap: 8 }}>
        <Button title="Tambah barang" disabled={!!edit} onPress={() => setEdit({ kind: 'product' })} />
        {edit?.kind === 'product' && !edit.product && <ProductForm tripId={trip.id}
          categories={categories.data || []} done={done} cancel={() => setEdit(null)} />}
      </View>}
      <ProductGrid products={trip.products} />
      {manage && active && trip.products.map(product => <View key={product.id} style={{ gap: 6 }}>
        <Button title={'Edit ' + product.name} secondary disabled={!!edit} onPress={() => setEdit({ kind: 'product', product })} />
        {edit?.kind === 'product' && edit.product?.id === product.id && <ProductForm tripId={trip.id} product={edit.product}
          categories={categories.data || []} done={done} cancel={() => setEdit(null)} />}
      </View>)}
      {manage && !!categories.error && <Button title="Muat ulang kategori" secondary onPress={() => void categories.refresh()} />}
      {!owner && active && session?.role === 'penitip' && <RequestForm tripId={trip.id} done={() => state.refresh(true)} />}
      <Text style={styles.heading}>Riwayat request</Text>
      {trip.requests.length === 0 && <Text style={styles.muted}>Belum ada request.</Text>}
      {trip.requests.map(item => <View style={styles.card} key={item.id}>
        <Text style={styles.heading}>{item.name}</Text>
        <Text style={styles.text}>{item.description}</Text>
        <Text style={styles.muted}>{item.buyer_name} · {statusLabels[item.status]}</Text>
        {manage && active && item.status === 'pending' && <View style={styles.row}>
          <Button title="Setujui" disabled={action.busy || !!edit} onPress={() => setEdit({ kind: 'approval', request: item })} />
          <Button title="Tolak" secondary disabled={action.busy || !!edit} onPress={() => void action.run(async () => {
            await call('review_request', { id: item.id, approve: false });
            await state.refresh(true);
          })} />
        </View>}
        {edit?.kind === 'approval' && edit.request.id === item.id && <ProductForm tripId={trip.id} approval={edit.request}
          categories={categories.data || []} done={done} cancel={() => setEdit(null)} />}
      </View>)}
      {manage && <View style={styles.card}>
        <Text style={styles.heading}>Ringkasan belanja</Text>
        {trip.summary?.length ? trip.summary.map(item => <Text style={styles.text} key={item.product_id + ':' + item.name}>
          {item.quantity} × {item.name} · {money(item.total)}
        </Text>) : <Text style={styles.muted}>Belum ada pesanan.</Text>}
      </View>}
      {manage && duringTrip && trip.status === 'live' && <CheckinForm tripId={trip.id} done={() => state.refresh(true)} />}
      <Text style={styles.heading}>Riwayat lokasi</Text>
      {point ? <>
        <CheckinMap checkins={trip.checkins} selected={point} />
        <View style={styles.card}>
          <Photo path={point.photo} label="Selfie check-in" />
          <Text style={styles.text}>{point.note} · {point.created_at}</Text>
          <Text style={styles.muted}>Akurasi {Math.round(point.accuracy)} m</Text>
        </View>
        {trip.checkins.map(item => <Button key={item.id} title={item.note + ' · ' + item.created_at}
          secondary={item.id !== point.id} onPress={() => setSelected(item.id)} />)}
      </> : <Text style={styles.muted}>Belum ada check-in.</Text>}
    </>}
  </Page>;
}
