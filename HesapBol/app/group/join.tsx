import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function JoinGroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { session, initialized } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [errorDesc, setErrorDesc] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to initialize before doing anything
    if (!initialized) return;
    
    // If not logged in, redirect to login. The auth provider should technically do this, but just in case.
    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    if (!id || typeof id !== 'string' || id.length !== 36) {
      setErrorDesc('Geçersiz davet bağlantısı.');
      setLoading(false);
      return;
    }

    // Check if user is already in the group or if group exists
    verifyGroupAndMembership();
  }, [id, session, initialized]);

  const verifyGroupAndMembership = async () => {
    try {
      setLoading(true);
      setErrorDesc(null);

      // 1. Fetch Group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name, avatar_url, created_by')
        .eq('id', id)
        .single();
        
      if (groupError || !groupData) {
        setErrorDesc('Bu grup bulunamadı veya silinmiş.');
        return;
      }
      
      setGroupInfo(groupData);

      // 2. Check if already a member
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', id)
        .eq('user_id', session!.user.id)
        .single();

      if (memberData) {
        // User is already a member, just redirect them to the group
        Alert.alert('Zaten Üyesiniz', `"${groupData.name}" grubuna zaten üyesiniz.`, [
          { text: 'Tamam', onPress: () => router.replace(`/group/${id}`) }
        ]);
        return;
      }

    } catch (err: any) {
      setErrorDesc(err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!id || !session) return;
    
    setJoining(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: id,
          user_id: session.user.id
        });

      if (error) throw error;

      Alert.alert(
        'Hoş Geldiniz! 🎉', 
        `"${groupInfo.name}" grubuna başarıyla katıldınız.`,
        [{ text: 'Devam Et', onPress: () => router.replace(`/group/${id}`) }]
      );
      
    } catch (err: any) {
      Alert.alert('Katılım Hatası', err.message || 'Gruba katılırken bir sorun oluştu.');
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = () => {
    router.replace('/(tabs)');
  };

  if (!initialized || loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#1CC29F" />
        <Text className="mt-4 text-muted font-medium">Davet kontrol ediliyor...</Text>
      </View>
    );
  }

  if (errorDesc) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-6">
        <Text className="text-6xl mb-4">⚠️</Text>
        <Text className="text-xl font-bold text-text text-center mb-2">Bağlantı Geçersiz</Text>
        <Text className="text-muted text-center mb-8">{errorDesc}</Text>
        <TouchableOpacity 
          className="bg-primary w-full h-14 rounded-full flex-row justify-center items-center"
          onPress={() => router.replace('/(tabs)')}
        >
          <Text className="text-white font-extrabold text-lg">Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background justify-center items-center px-6">
      
      <View className="bg-card w-full rounded-[32px] p-8 items-center border border-border" style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 } : { elevation: 6 }}>
        <Text className="text-muted text-sm font-bold tracking-widest uppercase mb-6">Gruba Davet Edildiniz</Text>
        
        <View className="w-24 h-24 bg-primary/10 rounded-full justify-center items-center mb-4 border-4 border-background">
          <Text className="text-5xl">{groupInfo?.avatar_url || '👥'}</Text>
        </View>
        
        <Text className="text-2xl font-extrabold text-text text-center mb-2 tracking-tight">
          {groupInfo?.name}
        </Text>
        
        <Text className="text-muted text-center leading-6 mb-8">
          Masrafları bölüşmek için sana gönderilen bu daveti kabul ederek gruba katılabilirsin.
        </Text>

        <TouchableOpacity 
          className="bg-primary w-full h-14 rounded-full flex-row justify-center items-center mb-3"
          onPress={handleJoin}
          disabled={joining}
          style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 } : { elevation: 4 }}
        >
          {joining ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-extrabold text-lg tracking-wide">Gruba Katıl</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          className="w-full h-12 flex-row justify-center items-center"
          onPress={handleCancel}
          disabled={joining}
        >
          <Text className="text-muted font-bold text-base">İptal veya Reddet</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}
