import MapView, { Marker } from 'react-native-maps';
import type { Checkin } from './api';

export default function CheckinMap({ checkins, selected }: { checkins: Checkin[]; selected: Checkin }) {
  return <MapView
    key={selected.id}
    accessibilityLabel="Peta riwayat lokasi trip"
    style={{ height: 270, borderRadius: 12 }}
    initialRegion={{ latitude: Number(selected.latitude), longitude: Number(selected.longitude), latitudeDelta: 0.035, longitudeDelta: 0.035 }}>
    {checkins.map(point => <Marker key={point.id}
      coordinate={{ latitude: Number(point.latitude), longitude: Number(point.longitude) }}
      title={point.note} description={point.created_at} />)}
  </MapView>;
}
