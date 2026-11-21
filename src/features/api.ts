import AsyncStorage from '@react-native-async-storage/async-storage';

export const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://ubaya.fun/flutter/160423172').replace(/\/+$/, '');
export type Role = 'penitip' | 'jastiper';
export type User = { id: number; name: string; email: string };
export type Session = { token: string; user: User; role: Role };
export type Category = { id: number; name: string };
export type Review = { id: number; buyer_name: string; comment: string; rating: number };
export type Product = {
  id: number; trip_id: number; owner_id: number; name: string; trip_name: string; photo: string;
  description: string; price: number; stock: number; favorite: number; categories: Category[];
  reviews?: Review[];
};
export type Checkin = {
  id: number; latitude: number; longitude: number; accuracy: number; photo: string; note: string; created_at: string;
};
export type Request = { id: number; name: string; description: string; buyer_name: string; status: string };
export type Trip = {
  id: number; owner_id: number; owner_name: string; name: string; destination: string;
  departure: string; return_date: string; status: string;
  products: Product[]; checkins: Checkin[]; requests: Request[];
  summary?: { product_id: number; name: string; quantity: number; total: number }[];
};
export type CartItem = Product & { quantity: number };
export type Order = {
  id: number; trip_name: string; buyer_name: string; seller_name: string; total: number; status: string;
  rating: number | null; items: { id: number; name: string; quantity: number; price: number }[];
};
export type Wallet = { balance: number; ledger: { id: number; amount: number; description: string; created_at: string }[] };
export type Notice = { id: number; message: string; is_read: number; created_at: string };

const storageKey = 'jastipgo.session:' + baseUrl;
export async function restoreSession(): Promise<Session | null> {
  const saved = await AsyncStorage.getItem(storageKey);
  if (!saved) return null;
  try {
    const value = JSON.parse(saved);
    if (typeof value.token === 'string' && value.user?.id && ['penitip', 'jastiper'].includes(value.role)) {
      return value;
    }
  } catch {
    // Invalid local data falls through to cleanup.
  }
  await saveSession(null);
  return null;
}

export function saveSession(session: Session | null) {
  return session ? AsyncStorage.setItem(storageKey, JSON.stringify(session)) : AsyncStorage.removeItem(storageKey);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function request<T>(session: Session | null, action: string, values: object = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(baseUrl + (action === 'upload' ? '/uploadimage.php' : '/api.php'), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: 'Bearer ' + session.token, 'X-Role': session.role } : {}),
      },
      body: JSON.stringify({ action, ...values }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.result !== 'success') {
      throw new ApiError(body?.message || 'Respons server tidak valid. Periksa alamat API.', response.status);
    }
    return body.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Tidak dapat terhubung ke server. Coba lagi.', 0);
  } finally {
    clearTimeout(timeout);
  }
}

export const photoUrl = (path: string) => baseUrl + '/image.php?path=' + encodeURIComponent(path);
export const money = (value: number) => 'Rp' + Number(value).toLocaleString('id-ID');
export const message = (error: unknown) => error instanceof Error ? error.message : 'Permintaan gagal.';
export const statusLabels: Record<string, string> = {
  open: 'Dibuka', live: 'Sedang berlangsung', finished: 'Trip selesai', paid: 'Dibayar',
  purchased: 'Dibeli', delivered: 'Diserahkan', completed: 'Selesai', pending: 'Menunggu',
  approved: 'Disetujui', rejected: 'Ditolak',
};
