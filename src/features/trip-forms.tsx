import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import type { Category, Product, Request, Trip } from './api';
import { Categories } from './products';
import { useSession } from './session';
import { Button, colors, Feedback, Field, Photo, styles, useAction } from './ui';

export function numberField(value: string, label: string, min: number, max = 2147483647) {
  const number = Number(value);
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(label + ' di luar batas yang diizinkan.');
  }
  return number;
}

async function choosePhoto(camera: boolean, front = false) {
  if (camera && Platform.OS !== 'web' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
    throw new Error('Izin kamera diperlukan.');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], base64: true, quality: 0.55, allowsEditing: true,
    cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  const result = await (camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options));
  if (result.canceled) return null;
  const image = result.assets[0]?.base64;
  if (!image) throw new Error('Foto tidak dapat dibaca.');
  return image;
}

export function TripForm({ trip, done, cancel }: { trip?: Trip; done: (id: number) => Promise<void>; cancel: () => void }) {
  const { call } = useSession();
  const action = useAction();
  const [name, setName] = useState(trip?.name || '');
  const [destination, setDestination] = useState(trip?.destination || '');
  const [departure, setDeparture] = useState(trip?.departure || '');
  const [returnDate, setReturnDate] = useState(trip?.return_date || '');
  return <View style={styles.card}>
    <Text style={styles.heading}>{trip ? 'Edit trip' : 'Buka trip'}</Text>
    <Field label="Nama trip" value={name} onChangeText={setName} maxLength={150} />
    <Field label="Destinasi" value={destination} onChangeText={setDestination} maxLength={150} />
    <Field label="Berangkat (YYYY-MM-DD)" value={departure} onChangeText={setDeparture} placeholder="YYYY-MM-DD" maxLength={10} />
    <Field label="Kembali (YYYY-MM-DD)" value={returnDate} onChangeText={setReturnDate} placeholder="YYYY-MM-DD" maxLength={10} />
    <Feedback error={action.error} loading={action.busy} />
    <View style={styles.row}>
      <Button title="Simpan trip" disabled={action.busy} onPress={() => void action.run(async () => {
        if (!name.trim() || !destination.trim()) throw new Error('Isi nama trip dan destinasi.');
        if (![departure, returnDate].every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)) || returnDate < departure) {
          throw new Error('Periksa tanggal berangkat dan kembali.');
        }
        const result = await call<{ id: number }>('save_trip', { id: trip?.id, name: name.trim(), destination: destination.trim(), departure, return_date: returnDate });
        await done(result.id);
      })} />
      <Button title="Batal" secondary disabled={action.busy} onPress={cancel} />
    </View>
  </View>;
}

export function RequestForm({ tripId, done }: { tripId: number; done: () => Promise<void> }) {
  const { call } = useSession();
  const action = useAction();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return <View style={styles.card}>
    <Text style={styles.heading}>Ajukan request</Text>
    <Field label="Nama barang" value={name} onChangeText={setName} maxLength={150} />
    <Field label="Deskripsi" value={description} onChangeText={setDescription} maxLength={5000} multiline />
    <Feedback error={action.error} loading={action.busy} />
    <Button title="Kirim request" disabled={action.busy} onPress={() => void action.run(async () => {
      if (!name.trim() || !description.trim()) throw new Error('Isi nama dan deskripsi barang.');
      await call('request', { trip_id: tripId, name: name.trim(), description: description.trim() });
      setName(''); setDescription('');
      await done();
    })} />
  </View>;
}

export function ProductForm({ tripId, product, approval, categories, done, cancel }: {
  tripId: number; product?: Product; approval?: Request; categories: Category[]; done: () => Promise<void>; cancel: () => void;
}) {
  const { call } = useSession();
  const action = useAction();
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [photo, setPhoto] = useState(product?.photo || '');
  const [selected, setSelected] = useState(product?.categories.map(category => Number(category.id)) || []);
  const [sheet, setSheet] = useState(false);
  function pick(camera: boolean) {
    setSheet(false);
    void action.run(async () => {
      const image = await choosePhoto(camera);
      if (image) setPhoto((await call<{ path: string }>('upload', { image })).path);
    });
  }
  return <View style={styles.card}>
    <Text style={styles.heading}>{approval ? 'Setujui ' + approval.name : product ? 'Edit barang' : 'Tambah barang'}</Text>
    {!approval && <>
      <Field label="Nama barang" value={name} onChangeText={setName} maxLength={150} />
      <Field label="Deskripsi" value={description} onChangeText={setDescription} maxLength={5000} multiline />
    </>}
    <Field label="Harga (Rp)" value={price} onChangeText={setPrice} keyboardType="number-pad" />
    <Field label="Stok" value={stock} onChangeText={setStock} keyboardType="number-pad" />
    <Text style={styles.muted}>Kategori barang</Text>
    <Categories categories={categories} selected={selected}
      toggle={id => setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id])} />
    <Photo path={photo} label="Foto barang" />
    <Button title={photo ? 'Ganti foto' : 'Pilih foto'} secondary disabled={action.busy} onPress={() => setSheet(true)} />
    <Modal transparent visible={sheet} animationType="slide" onRequestClose={() => setSheet(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' }}>
        <Pressable style={{ flex: 1 }} onPress={() => setSheet(false)} accessibilityLabel="Tutup pilihan foto" />
        <View style={[styles.card, { backgroundColor: colors.white, paddingBottom: 30 }]}>
          <Text style={styles.heading}>Pilih sumber foto</Text>
          <Button title="Kamera" onPress={() => pick(true)} />
          <Button title="Galeri" secondary onPress={() => pick(false)} />
          <Button title="Batal" secondary onPress={() => setSheet(false)} />
        </View>
      </View>
    </Modal>
    <Feedback error={action.error} loading={action.busy} />
    <View style={styles.row}>
      <Button title={approval ? 'Setujui dan tayangkan' : 'Simpan barang'} disabled={action.busy} onPress={() => void action.run(async () => {
        if (!approval && (!name.trim() || !description.trim())) throw new Error('Isi nama dan deskripsi barang.');
        if (!photo) throw new Error('Pilih foto barang.');
        const values = { price: numberField(price, 'Harga', 1), stock: numberField(stock, 'Stok', approval ? 1 : 0, 100000), photo, category_ids: selected };
        if (approval) await call('review_request', { ...values, id: approval.id, approve: true });
        else await call('save_product', { ...values, id: product?.id, trip_id: tripId, name: name.trim(), description: description.trim() });
        await done();
      })} />
      <Button title="Batal" secondary disabled={action.busy} onPress={cancel} />
    </View>
  </View>;
}

export function CheckinForm({ tripId, done }: { tripId: number; done: () => Promise<void> }) {
  const { call } = useSession();
  const action = useAction();
  const [note, setNote] = useState('');
  return <View style={styles.card}>
    <Text style={styles.heading}>Check-in lokasi toko</Text>
    <Field label="Catatan lokasi" value={note} onChangeText={setNote} maxLength={200} />
    <Feedback error={action.error} loading={action.busy} />
    <Button title="Check-in lokasi saat ini" disabled={action.busy} onPress={() => void action.run(async () => {
      if (!note.trim()) throw new Error('Isi catatan lokasi.');
      if (Platform.OS === 'web') throw new Error('Gunakan aplikasi Android atau iOS untuk mengambil selfie langsung.');
      const image = await choosePhoto(true, true);
      if (!image) return;
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Izin lokasi diperlukan.');
      const { coords, mocked } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (mocked) throw new Error('Lokasi simulasi tidak dapat digunakan.');
      if (coords.accuracy == null) throw new Error('Akurasi GPS belum tersedia. Coba lagi.');
      const { path } = await call<{ path: string }>('upload', { image });
      await call('checkin', { trip_id: tripId, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, note: note.trim(), photo: path });
      setNote('');
      await done();
    })} />
  </View>;
}
