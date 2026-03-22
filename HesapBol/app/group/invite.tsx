import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

export default function GroupInviteScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [needsInvite, setNeedsInvite] = useState(false);

  const handleSearch = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Geçersiz E-Posta', 'Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    setLoading(true);
    setSearchResult(null);
    setSearched(true);
    setNeedsInvite(false);

    try {
      // 1. Check if user is in our public.users table
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .ilike('email', email.trim());

      if (error) {
        console.error('Search error:', error);
        setSearchResult(null);
      } else if (data && data.length > 0) {
        setSearchResult(data[0]);
      } else {
        // Person not found, they likely need to register. Show invite button.
        setSearchResult(null);
        setNeedsInvite(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: Linking.createURL('/')
        }
      });
      
      if (error) throw error;
      
      Alert.alert(
        'Davetiye Gönderildi! 📧', 
        `${email} adresine HesapBöl uygulamasına katılması için bir giriş linki gönderildi.`,
        [{ text: 'Tamam', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Davetiye Hatası', err.message || 'Davetiye gönderilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!searchResult) return;
    
    setLoading(true);
    try {
      // Check if already in the group
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', searchResult.id)
        .single();
        
      if (existingMember) {
        Alert.alert('Zaten Eklendi', 'Bu kullanıcı zaten grubun bir üyesi.');
        setLoading(false);
        return;
      }

      // Add to group
      const { error: insertError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: searchResult.id
        });

      if (insertError) throw insertError;

      Alert.alert(
        'Başarılı! ✅', 
        `${searchResult.name || searchResult.email} gruba eklendi!`, 
        [{ text: 'Tamam', onPress: () => router.back() }]
      );
      
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Kullanıcı eklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background pt-14">
      <View className="flex-row items-center justify-between px-6 pb-4 mb-2">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Text className="text-muted text-lg font-medium">İptal</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text tracking-tight">Gruba Üye Ekle</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="items-center mb-10">
          <View className="w-24 h-24 bg-primary/10 rounded-full justify-center items-center mb-4 border-2 border-primary/20">
            <Text className="text-5xl">📨</Text>
          </View>
          <Text className="text-text text-2xl font-extrabold mb-2 text-center">Üye Ara ve Ekle</Text>
          <Text className="text-muted text-center font-medium leading-5 px-4 mb-2">
            Gruba eklemek istediğin kişinin e-posta adresini girerek arama yapabilirsin.
          </Text>
        </View>

        <Text className="text-muted uppercase text-xs font-bold mb-3 tracking-wider ml-2">E-Posta Adresi</Text>
        <View className="flex-row mb-4">
          <TextInput
            className="flex-1 bg-card rounded-l-[20px] px-6 py-5 text-text text-lg border border-border border-r-0"
            placeholder="Örn: ahmet@fake.com"
            placeholderTextColor="#999999"
            value={email}
            onChangeText={(text) => { setEmail(text); setSearched(false); setSearchResult(null); setNeedsInvite(false); }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : { elevation: 1 }}
          />
          <TouchableOpacity 
            className="bg-primary rounded-r-[20px] px-6 justify-center items-center"
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white font-bold text-base">Ara</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Result */}
        {searched && !loading && (
          searchResult ? (
            <View className="bg-card rounded-[24px] p-6 border border-border mb-6" 
              style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 } : { elevation: 2 }}>
              <View className="flex-row items-center mb-4">
                <View className="w-14 h-14 bg-primary/10 rounded-full justify-center items-center mr-4 border border-primary/20">
                  <Text className="text-2xl font-bold text-primary">
                    {searchResult.name ? searchResult.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text font-bold text-lg">{searchResult.name || 'İsimsiz'}</Text>
                  <Text className="text-muted text-sm">{searchResult.email}</Text>
                </View>
              </View>
              <TouchableOpacity 
                className="bg-primary rounded-full py-4 items-center"
                onPress={handleAddMember}
                disabled={loading}
                style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 } : { elevation: 6 }}
              >
                <Text className="text-white font-extrabold text-lg">Gruba Ekle</Text>
              </TouchableOpacity>
            </View>
          ) : needsInvite ? (
            <View className="bg-card rounded-[24px] p-8 border border-border items-center mb-6" style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 } : { elevation: 2 }}>
              <View className="w-16 h-16 bg-blue-500/10 rounded-full justify-center items-center mb-4">
                <Text className="text-3xl">📨</Text>
              </View>
              <Text className="text-text font-bold text-lg mb-2 text-center">Kullanıcı Bulunamadı</Text>
              <Text className="text-muted text-sm text-center leading-5 mb-6">
                <Text className="font-bold text-text">{email.trim()}</Text> adresine sahip bir kullanıcı bulunamadı. Uygulamaya üye olması için bir davetiye bağlantısı gönderebilirsiniz.
              </Text>
              
              <TouchableOpacity 
                className="bg-[#2D8CFF] rounded-full py-4 text-center items-center w-full px-6 flex-row justify-center"
                onPress={handleSendInvite}
                disabled={loading}
                style={Platform.OS === 'ios' ? { shadowColor: '#2D8CFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 } : { elevation: 6 }}
              >
                <Text className="text-white font-extrabold text-lg mr-2">Davetiye Gönder</Text>
                <Text className="text-lg">📧</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="bg-card rounded-[24px] p-8 border border-border items-center mb-6">
              <Text className="text-4xl mb-3">🔍</Text>
              <Text className="text-text font-bold text-lg mb-2 text-center">Arama Yapın</Text>
              <Text className="text-muted text-sm text-center leading-5">
                Kullanıcıları bulmak için tam e-posta adresini girin.
              </Text>
            </View>
          )
        )}

        <Text className="text-muted text-xs text-center px-4 mt-2">
          Sistem üzerinde kayıtlı kullanıcılar aranır. Arama e-posta adresine göre yapılır.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
