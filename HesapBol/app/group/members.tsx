import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function GroupMembersScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const { session } = useAuth();
  
  const [members, setMembers] = useState<any[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingMemberId, setActingMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (groupId && String(groupId).length === 36) {
      fetchMembers();
    } else if (groupId) {
      router.back();
    }
  }, [groupId]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data: groupData } = await supabase
      .from('groups')
      .select('created_by')
      .eq('id', groupId)
      .single();

    if (groupData) {
      setAdminId(groupData.created_by);
    }

    const { data, error } = await supabase
      .from('group_members')
      .select('user_id, joined_at, users(name, email)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });
      
    if (error) {
       Alert.alert('Hata', 'Üyeler alınamadı.');
    }
    
    if (data) {
      setMembers(data);
    }
    setLoading(false);
  };

  const handleRemoveMember = (uid: string, isSelf: boolean) => {
    Alert.alert(
      isSelf ? 'Gruptan Ayrıl' : 'Üyeyi Çıkar',
      isSelf 
        ? 'Bu gruptan ayrılırsanız, size ait tüm harcamalar silinecek. Emin misiniz?'
        : 'Bu üyeyi gruptan çıkardığınızda, üyeye ait tüm harcamalar da silinecektir. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: isSelf ? 'Ayrıl' : 'Çıkar',
          style: 'destructive',
          onPress: async () => {
             try {
                setActingMemberId(uid);

                // 1. Delete all expenses paid by this user
                await supabase.from('expenses').delete().eq('group_id', groupId).eq('paid_by', uid);

                // 2. Fetch all expenses in this group to delete their splits from others' expenses
                const { data: gExpenses } = await supabase.from('expenses').select('id').eq('group_id', groupId);
                if (gExpenses && gExpenses.length > 0) {
                   const ids = gExpenses.map((e: any) => e.id);
                   await supabase.from('expense_splits').delete().eq('user_id', uid).in('expense_id', ids);
                }

                // 3. Remove membership
                const { error: memberError } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', uid);
                
                if (memberError) throw memberError;

                if (isSelf) {
                   router.replace('/(tabs)');
                } else {
                   // Refresh list if we just kicked someone
                   fetchMembers();
                }
             } catch (error: any) {
                Alert.alert('Hata', error.message || 'Bir sorun oluştu.');
             } finally {
                setActingMemberId(null);
             }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 bg-background pt-14 pb-10">
      <View className="flex-row items-center justify-between px-6 pb-4 border-b border-border/50">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2" disabled={actingMemberId !== null}>
          <Text className="text-primary text-3xl font-light">‹</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text tracking-tight">Grup Üyeleri</Text>
        <TouchableOpacity onPress={() => router.push(`/group/invite?groupId=${groupId}`)} className="p-2 -mr-2" disabled={actingMemberId !== null}>
          <Text className="text-primary text-2xl font-light">+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
         <View className="flex-1 justify-center items-center">
            <ActivityIndicator color="#1CC29F" size="large" />
         </View>
      ) : (
         <ScrollView className="flex-1 px-6 pt-4">
            {members.map((m) => {
               const isMe = m.user_id === session?.user?.id;
               const isThisAdmin = m.user_id === adminId;
               const iAmAdmin = session?.user?.id === adminId;
               const isActing = actingMemberId === m.user_id;
               const name = m.users?.name || m.users?.email?.split('@')[0] || 'İsimsiz';
               const email = m.users?.email || '';

               return (
                  <View key={m.user_id} className={`flex-row items-center justify-between p-4 rounded-2xl mb-3 border ${isThisAdmin ? 'bg-primary/15 border-primary' : 'bg-card border-border'}`} style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 } : { elevation: 1 }}>
                     <View className="flex-row items-center flex-1 pr-2">
                        <View className={`w-12 h-12 rounded-full justify-center items-center border-2 mr-3 ${isMe ? 'bg-primary/20 border-primary' : 'bg-background border-border'}`}>
                           <Text className={`font-bold text-lg ${isMe ? 'text-primary' : 'text-text'}`}>
                              {name.charAt(0).toUpperCase()}
                           </Text>
                        </View>
                        <View className="flex-1">
                           <View className="flex-row items-center">
                              <Text className="text-text font-bold text-base" numberOfLines={1}>
                                 {name} {isMe && <Text className="text-primary text-sm">(Siz)</Text>}
                              </Text>
                              {isThisAdmin && (
                                 <View className="bg-primary px-2 py-0.5 rounded-full ml-2">
                                    <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Yönetici</Text>
                                 </View>
                              )}
                           </View>
                           <Text className="text-muted text-xs" numberOfLines={1}>{email}</Text>
                        </View>
                     </View>
                     
                     {isMe ? (
                        <TouchableOpacity 
                           onPress={() => handleRemoveMember(m.user_id, true)}
                           disabled={actingMemberId !== null}
                           className="bg-secondary/10 px-4 py-2 rounded-full border border-secondary/20"
                        >
                           {isActing ? (
                              <ActivityIndicator color="#FF6B6B" size="small" />
                           ) : (
                              <Text className="text-secondary font-bold text-xs">Ayrıl</Text>
                           )}
                        </TouchableOpacity>
                     ) : iAmAdmin ? (
                        <TouchableOpacity 
                           onPress={() => handleRemoveMember(m.user_id, false)}
                           disabled={actingMemberId !== null}
                           className="bg-card px-4 py-2 rounded-full border border-border"
                        >
                           {isActing ? (
                              <ActivityIndicator color="#6C6C80" size="small" />
                           ) : (
                              <Text className="text-muted font-bold text-xs">Çıkar</Text>
                           )}
                        </TouchableOpacity>
                     ) : null}
                  </View>
               );
            })}
         </ScrollView>
      )}
    </View>
  );
}
