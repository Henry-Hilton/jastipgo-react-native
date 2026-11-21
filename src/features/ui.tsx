import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { message, photoUrl } from './api';

export const colors = { ink: '#1c2825', muted: '#52645c', green: '#166149', pale: '#e3efe7', paper: '#f5f7f2', white: '#fff', line: '#d8e1d8', red: '#a02937' };
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, gap: 14, width: '100%', maxWidth: 900, alignSelf: 'center' },
  title: { fontWeight: '800', fontSize: 30, color: colors.ink },
  heading: { fontWeight: '700', fontSize: 19, color: colors.ink },
  text: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.red, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 9 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderColor: colors.line, borderWidth: 1, borderRadius: 10, backgroundColor: colors.white, color: colors.ink, fontSize: 16 },
  button: { minHeight: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.green, paddingHorizontal: 14, paddingVertical: 8 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  image: { width: '100%', aspectRatio: 1.55, borderRadius: 10, backgroundColor: colors.pale },
});

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {children}
  </ScrollView>;
}

export function Button({ title, onPress, disabled, secondary }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    style={[styles.button, secondary && { backgroundColor: colors.pale }, disabled && { opacity: 0.55 }]} onPress={onPress}>
    <Text style={[styles.buttonText, secondary && { color: colors.green }]}>{title}</Text>
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 5 }}>
    <Text style={styles.muted}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props}
      style={[styles.input, props.multiline && { minHeight: 92, textAlignVertical: 'top' }]} />
  </View>;
}

export function Photo({ path, label }: { path: string; label: string }) {
  return path ? <Image accessibilityLabel={label} source={{ uri: photoUrl(path) }} style={styles.image} resizeMode="cover" /> : null;
}

export function Feedback({ error, loading }: { error?: string; loading?: boolean }) {
  return <>{loading && <ActivityIndicator color={colors.green} />}{!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}</>;
}

export function useData<T>(load: () => Promise<T>, pollMs?: number) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async (quiet = false) => {
    const id = ++sequence.current;
    if (!quiet) setLoading(true);
    try {
      const result = await load();
      if (id === sequence.current) { setData(result); setError(''); }
    } catch (err) {
      if (id === sequence.current) setError(message(err));
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [load]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = pollMs ? setInterval(() => { void refresh(true); }, pollMs) : undefined;
    return () => { clearInterval(timer); sequence.current++; };
  }, [refresh, pollMs]));
  return { data, error, loading, refresh };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try { await work(); }
    catch (err) { if (mounted.current) setError(message(err)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return { busy, error, run };
}
