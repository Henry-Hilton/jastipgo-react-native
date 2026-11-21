import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { money, type Category, type Product } from './api';
import { Button, Photo, styles } from './ui';

export function Categories({ categories, selected, toggle }: { categories: Category[]; selected: number[]; toggle: (id: number) => void }) {
  return <View style={styles.row}>{categories.map(category =>
    <Button key={category.id} title={category.name} secondary={!selected.includes(Number(category.id))}
      onPress={() => toggle(Number(category.id))} />)}</View>;
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <Text style={styles.muted}>Belum ada barang.</Text>;
  return <View style={styles.grid}>{products.map(product =>
    <Pressable accessibilityRole="link" key={product.id} style={[styles.card, { width: '48%' }]}
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}>
      <Photo path={product.photo} label={product.name} />
      <Text style={styles.heading}>{product.name}</Text>
      <Text style={styles.muted}>{product.trip_name} · Stok {product.stock}</Text>
      <Text style={styles.text}>{money(product.price)}</Text>
    </Pressable>)}</View>;
}
