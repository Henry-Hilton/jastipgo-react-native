import type { Checkin } from './api';

export default function CheckinMap({ selected }: { checkins: Checkin[]; selected: Checkin }) {
  const latitude = Number(selected.latitude);
  const longitude = Number(selected.longitude);
  const bounds = [longitude - 0.0175, latitude - 0.0175, longitude + 0.0175, latitude + 0.0175];
  const url = 'https://www.openstreetmap.org/export/embed.html?layer=mapnik&bbox=' +
    encodeURIComponent(bounds.join(',')) + '&marker=' + encodeURIComponent(latitude + ',' + longitude);
  return <iframe title="Peta lokasi trip · OpenStreetMap" src={url} loading="lazy"
    style={{ height: 270, width: '100%', border: 0, borderRadius: 12 }} />;
}
