import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 1. Çevre Değişkenlerinin Güvenli Çağrımı
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL veya Anon Key bulunamadı. Lütfen kök dizindeki .env dosyanızı kontrol edin.');
}

// 2. Güvenli Depolama (Secure Store) Adaptörü
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Web SSR ve Web (Tarayıcı) için fall-back (Web'de SecureStore desteklenmez)
const isWebSSR = Platform.OS === 'web' && typeof window === 'undefined';
const isWeb = Platform.OS === 'web';

const customStorage = isWebSSR
  ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  : isWeb
  ? AsyncStorage
  : ExpoSecureStoreAdapter; // Native mobil cihazlar için güvenli adaptör

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    storage: customStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
