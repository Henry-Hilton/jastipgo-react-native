import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import type { Category, Product } from '@/features/api';
import { Categories, ProductGrid } from '@/features/products';
import { useSession } from '@/features/session';
import { Button, Feedback, Field, Page, styles, useData } from '@/features/ui';

export default function Catalog() {
  const { call } = useSession();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [filter, setFilter] = useState({ name: '', destination: '' });
  const [category, setCategory] = useState(0);
  const [favorites, setFavorites] = useState(false);
  const categories = useData(useCallback(() => call<Category[]>('categories'), [call]));
  const items = useData(useCallback(() => call<Product[]>('catalog', {
    ...filter, category_id: category, favorites,
  }), [call, category, favorites, filter]));
  return <SafeAreaView edges={['top']} style={styles.page}><Page title="Katalog">
    <View style={styles.card}>
      <Field label="Nama barang" value={name} onChangeText={setName} maxLength={150} />
      <Field label="Nama trip atau destinasi" value={destination} onChangeText={setDestination} maxLength={150} />
      <View style={styles.row}>
        <Button title="Cari barang" onPress={() => setFilter({ name: name.trim(), destination: destination.trim() })} />
        <Button title="Favorit" secondary={!favorites} onPress={() => setFavorites(!favorites)} />
      </View>
      <Text style={styles.muted}>Kategori</Text>
      <Categories categories={categories.data || []} selected={[category]} toggle={id => setCategory(category === id ? 0 : id)} />
      <Feedback error={categories.error} />
    </View>
    <Feedback error={items.error} loading={items.loading} />
    {!!items.error && <Button title="Muat ulang" onPress={() => void items.refresh()} />}
    {items.data && <ProductGrid products={items.data} />}
  </Page></SafeAreaView>;
}
