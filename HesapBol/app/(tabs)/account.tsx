import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Image } from 'react-native';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from 'nativewind';

export default function AccountScreen() {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark');
  const { colorScheme, setColorScheme } = useColorScheme();
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      fetchProfile();
    }
    // Load saved theme preference
    AsyncStorage.getItem('themeMode').then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeMode(stored);
        setColorScheme(stored);
      }
    });
  }, [user]);

  const changeTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    setColorScheme(mode);
    AsyncStorage.setItem('themeMode', mode);
  };

  const fetchProfile = async () => {
    setFetching(true);
    const { data } = await supabase.from('users').select('name, avatar_url').eq('id', user?.id).single();
    if (data) {
      if (data.name) setName(data.name);
      if (data.avatar_url) setAvatarUrl(data.avatar_url);
    }
    if (user?.user_metadata?.phone) setPhone(user.user_metadata.phone);
    else if (user?.phone) setPhone(user.phone);
    setFetching(false);
  };

  const uploadAvatar = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const img = result.assets[0];
    if (!img.base64) { Alert.alert('Hata', 'Fotoğraf verisi alınamadı.'); return; }
    setUploadingAvatar(true);
    try {
      const ext = img.uri.substring(img.uri.lastIndexOf('.') + 1);
      const fileName = `${user?.id}_${Date.now()}.${ext}`;
      const filePath = `avatars/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, decode(img.base64), { contentType: `image/${ext}` });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(publicData.publicUrl);
      const { error: dbError } = await supabase.from('users').update({ avatar_url: publicData.publicUrl }).eq('id', user?.id);
      if (dbError) throw dbError;
    } catch (error: any) {
      Alert.alert('Fotoğraf Yükleme Hatası', error.message || 'Avatar güncellenemedi.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickImage = async (useCamera: boolean = false) => {
    let permissionResult;
    if (useCamera) {
      permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (permissionResult.status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için izin vermeniz gerekiyor.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    };
    const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) uploadAvatar(result);
  };

  const showAvatarOptions = () => {
    Alert.alert("Profil Fotoğrafı", "Fotoğraf eklemek/değiştirmek için bir yöntem seçin:", [
      { text: "Kameradan Çek", onPress: () => pickImage(true) },
      { text: "Galeriden Seç", onPress: () => pickImage(false) },
      { text: "İptal", style: "cancel" }
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Eksik Bilgi', 'İsim alanı boş bırakılamaz.'); return; }
    setLoading(true);
    const { error: dbError } = await supabase.from('users').update({ name }).eq('id', user?.id);
    const { error: authError } = await supabase.auth.updateUser({ data: { phone, name } });
    setLoading(false);
    if (dbError || authError) {
      Alert.alert('Hata', dbError?.message || authError?.message || 'Güncelleme başarısız oldu.');
    } else {
      setIsEditing(false);
      Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.');
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Hata', error.message);
  };

  if (fetching) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#1CC29F" />
      </View>
    );
  }

  const themeOptions: { key: 'light' | 'dark' | 'system'; icon: string; label: string }[] = [
    { key: 'light', icon: '☀️', label: 'Açık' },
    { key: 'dark', icon: '🌙', label: 'Koyu' },
    { key: 'system', icon: '📱', label: 'Sistem' },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-3xl font-extrabold text-text tracking-tight">Profilim</Text>
          {!isEditing ? (
            <TouchableOpacity onPress={() => setIsEditing(true)} className="bg-primary/10 px-4 py-2 rounded-full">
              <Text className="text-primary font-bold">Düzenle</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(false)} className="px-2">
              <Text className="text-muted font-bold">İptal</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Profile Card */}
        <View className="bg-card rounded-[32px] p-8 shadow-sm border border-border items-center mb-8" style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 } : { elevation: 3 }}>
          <TouchableOpacity 
             onPress={isEditing ? showAvatarOptions : undefined}
             disabled={uploadingAvatar || !isEditing}
             className="w-28 h-28 bg-primary/10 rounded-full items-center justify-center mb-5 border-4 border-background shadow-sm overflow-hidden relative"
          >
            {uploadingAvatar ? (
               <ActivityIndicator color="#1CC29F" />
            ) : avatarUrl ? (
               <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
            ) : (
               <Text className="text-primary text-5xl font-extrabold">
                 {name ? name.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : '?')}
               </Text>
            )}
            {isEditing && !uploadingAvatar && (
               <View className="absolute bottom-0 w-full bg-black/40 py-1 items-center">
                 <Text className="text-white text-xs font-bold">DEĞİŞTİR</Text>
               </View>
            )}
          </TouchableOpacity>
          
          <Text className="text-2xl font-bold text-text mb-1 tracking-tight">{name || 'İsimsiz Üye'}</Text>
          <Text className="text-muted font-medium mb-3">{email}</Text>
          <View className="bg-primary/20 px-4 py-1.5 rounded-full">
            <Text className="text-primary font-bold text-xs uppercase tracking-widest">HesapBöl Üyesi</Text>
          </View>
        </View>

        {/* Theme Selector */}
        <View className="bg-card rounded-[24px] p-5 border border-border mb-8"
          style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 } : { elevation: 2 }}>
          <Text className="text-muted uppercase text-xs font-bold mb-4 tracking-wider ml-1">Görünüm</Text>
          <View className="flex-row justify-between">
            {themeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => changeTheme(opt.key)}
                className={`flex-1 items-center py-3 mx-1 rounded-2xl border ${themeMode === opt.key ? 'bg-primary/15 border-primary' : 'bg-background border-border'}`}
              >
                <Text className="text-2xl mb-1">{opt.icon}</Text>
                <Text className={`text-sm font-bold ${themeMode === opt.key ? 'text-primary' : 'text-muted'}`}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isEditing && (
          <View className="mb-8">
            <Text className="text-muted uppercase text-xs font-bold mb-2 tracking-wider ml-2">İsim Soyisim</Text>
            <TextInput
              className="bg-card w-full rounded-2xl px-5 py-4 mb-4 text-text text-lg shadow-sm border border-border"
              placeholder="Örn: Ahmet Yılmaz" placeholderTextColor="#999999"
              value={name} onChangeText={setName}
            />
            <Text className="text-muted uppercase text-xs font-bold mb-2 tracking-wider ml-2">Telefon Numarası</Text>
            <TextInput
              className="bg-card w-full rounded-2xl px-5 py-4 mb-4 text-text text-lg shadow-sm border border-border"
              placeholder="Örn: 0555 123 4567" placeholderTextColor="#999999"
              value={phone} onChangeText={setPhone} keyboardType="phone-pad"
            />
            <Text className="text-muted uppercase text-xs font-bold mb-2 tracking-wider ml-2">E-Posta (Değiştirilemez)</Text>
            <TextInput
              className="bg-background w-full rounded-2xl px-5 py-4 mb-8 text-muted text-lg border border-border/50"
              value={email} editable={false}
            />
            <TouchableOpacity 
              className="bg-primary shadow-lg flex-row justify-center items-center rounded-full py-4 mb-4"
              onPress={handleSave} disabled={loading}
              style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 } : { elevation: 4 }}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-lg tracking-wide">Değişiklikleri Kaydet</Text>}
            </TouchableOpacity>
          </View>
        )}

        {!isEditing && (
          <TouchableOpacity 
            className="bg-card flex-row justify-center items-center rounded-full py-4 border border-border shadow-sm mt-auto"
            onPress={handleSignOut}
          >
            <Text className="text-secondary font-bold text-lg tracking-wide">Hesaptan Çıkış Yap</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
