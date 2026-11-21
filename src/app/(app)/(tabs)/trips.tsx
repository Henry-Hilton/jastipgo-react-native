import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { statusLabels, type Trip } from '@/features/api';
import { useSession } from '@/features/session';
import { TripForm } from '@/features/trip-forms';
import { Button, Feedback, Page, styles, useData } from '@/features/ui';

export default function Trips() {
  const { session, call } = useSession();
  const mine = session?.role === 'jastiper';
  const [creating, setCreating] = useState(false);
  const state = useData(useCallback(() => call<Trip[]>('trips', { mine }), [call, mine]));
  return <SafeAreaView edges={['top']} style={styles.page}><Page title={mine ? 'Trip saya' : 'Temukan trip'}>
    {mine && (creating ? <TripForm cancel={() => setCreating(false)} done={async id => {
      setCreating(false);
      router.push({ pathname: '/trip/[id]', params: { id } });
    }} /> : <Button title="Buka trip" onPress={() => setCreating(true)} />)}
    <Feedback loading={state.loading} error={state.error} />
    {!!state.error && <Button title="Muat ulang" onPress={() => void state.refresh()} />}
    {state.data?.length === 0 && <Text style={styles.muted}>Belum ada trip.</Text>}
    {state.data?.map(trip => <View style={styles.card} key={trip.id}>
      <Text style={styles.heading}>{trip.name}</Text>
      <Text style={styles.text}>{trip.destination} · {statusLabels[trip.status]}</Text>
      <Text style={styles.muted}>{trip.departure} s.d. {trip.return_date} · {trip.owner_name}</Text>
      <Button title="Lihat trip" secondary onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })} />
    </View>)}
  </Page></SafeAreaView>;
}
