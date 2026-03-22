import { View, Text, FlatList, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function GroupsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalBalances, setGlobalBalances] = useState({ total: 0, lent: 0, borrowed: 0 });

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          joined_at,
          groups (
            id,
            name,
            category,
            avatar_url
          )
        `)
        .eq('user_id', session.user.id)
        .order('joined_at', { ascending: false });

      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }

      if (data) {
        // Collect all group IDs the user belongs to
        const groupIds = data.map(m => m.group_id);

        let totalLent = 0;
        let totalBorrowed = 0;

        if (groupIds.length > 0) {
          // Fetch all expenses in all groups the user is part of
          const { data: expensesData, error: expError } = await supabase
            .from('expenses')
            .select(`
              id, amount, paid_by, group_id,
              expense_splits (user_id, amount_owed)
            `)
            .in('group_id', groupIds);

          if (!expError && expensesData) {
            expensesData.forEach(exp => {
               const splits = exp.expense_splits || [];
               
               if (exp.paid_by === session.user.id) {
                 // The user paid this. Everyone else owes them their split.
                 splits.forEach((split: any) => {
                   if (split.user_id !== session.user.id) {
                      totalLent += Number(split.amount_owed);
                   }
                 });
               } else {
                 // Someone else paid this. If the user is in the split, they owe.
                 const mySplit = splits.find((s: any) => s.user_id === session.user.id);
                 if (mySplit) {
                    totalBorrowed += Number(mySplit.amount_owed);
                 }
               }
            });
          }
        }
        
        setGlobalBalances({
           lent: totalLent,
           borrowed: totalBorrowed,
           total: totalLent - totalBorrowed
        });

        // Map the relational data to flat objects for the UI
        const formattedGroups = data
          .filter(m => m.groups)
          .map((m: any) => {
            const g = m.groups;
            return {
              id: g.id,
              name: g.name || 'İsimsiz Grup',
              avatar: g.avatar_url || '👥',
              balances: 'Detaylar için tıklayın', // Simplification for now
              debtStatus: 'neutral'
            };
          });
        setGroups(formattedGroups);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (num: number) =>
    Math.abs(num).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [session])
  );

  return (
    <View className="flex-1 bg-background pt-16 px-6">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-3xl font-extrabold text-text tracking-tight">Gruplar</Text>
        <TouchableOpacity 
          className="bg-primary/10 px-4 py-2 rounded-full"
          onPress={() => router.push('/group/new')}
        >
          <Text className="text-primary font-bold text-sm">+ Yeni Grup</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row justify-between mb-8 bg-card py-5 px-2 rounded-3xl border border-border" style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 } : { elevation: 2 }}>
        <View className="items-center flex-1 border-r border-border">
          <Text className="text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5">Toplam Bakiye</Text>
          <Text className={`font-extrabold text-xl ${globalBalances.total >= 0 ? 'text-primary' : 'text-secondary'}`}>
            {globalBalances.total < 0 ? '-' : ''}₺{formatAmount(globalBalances.total)}
          </Text>
        </View>
        <View className="items-center flex-1 border-r border-border">
          <Text className="text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5">Alacağınız</Text>
          <Text className="text-primary font-extrabold text-xl">₺{formatAmount(globalBalances.lent)}</Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-muted text-[10px] font-bold uppercase tracking-widest mb-1.5">Borcunuz</Text>
          <Text className="text-secondary font-extrabold text-xl">₺{formatAmount(globalBalances.borrowed)}</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#1CC29F" />
        </View>
      ) : groups.length === 0 ? (
        <View className="flex-1 justify-center items-center opacity-50 pb-20">
          <Text className="text-6xl mb-4">🏠</Text>
          <Text className="text-lg font-bold text-text mb-2">Henüz Grubunuz Yok</Text>
          <Text className="text-sm text-muted text-center max-w-[250px]">
            Masrafları bölüşmeye başlamak için sağ üstten yeni bir grup oluşturun.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="flex-row items-center p-4 mb-4 bg-card rounded-[24px] shadow-sm border border-border"
              style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : { elevation: 1 }}
              onPress={() => router.push(`/group/${item.id}`)}
            >
              <View className="w-14 h-14 bg-background rounded-2xl flex-row justify-center items-center mr-4 border border-border">
                <Text className="text-3xl">{item.avatar}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-text mb-1 tracking-tight">{item.name}</Text>
                <Text className={`text-sm font-medium ${item.debtStatus === 'positive' ? 'text-primary' : item.debtStatus === 'negative' ? 'text-secondary' : 'text-muted'}`}>
                  {item.balances}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
