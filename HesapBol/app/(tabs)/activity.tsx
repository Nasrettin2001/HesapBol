import { View, Text, FlatList, Platform, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function ActivityScreen() {
  const { session } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      if (!session?.user?.id) return;

      // Fetch recent expenses from all groups the user is a member of
      const { data: memberGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', session.user.id);

      if (!memberGroups || memberGroups.length === 0) {
        setActivities([]);
        return;
      }

      const groupIds = memberGroups.map(g => g.group_id);

      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          date,
          paid_by,
          group_id,
          groups (name),
          users:paid_by (name, email)
        `)
        .in('group_id', groupIds)
        .order('date', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching activities:', error);
        return;
      }

      if (data) {
        const formatted = data.map((exp: any) => {
          const isPaidByMe = exp.paid_by === session.user.id;
          const payerName = exp.users?.name || exp.users?.email?.split('@')[0] || 'Bilinmiyor';
          return {
            id: exp.id,
            expense: exp.description,
            group: exp.groups?.name || 'Grup',
            amount: `₺${Number(exp.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
            date: formatDate(exp.date),
            type: isPaidByMe ? 'paid' : 'owe',
            description: isPaidByMe ? 'Siz ödediniz' : `${payerName} ödedi`,
          };
        });
        setActivities(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return `Bugün, ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    if (days === 1) return `Dün, ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  useFocusEffect(
    useCallback(() => {
      fetchActivities();
    }, [session])
  );

  return (
    <View className="flex-1 bg-background pt-16 px-6">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-3xl font-extrabold text-text tracking-tight">Aktivite</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#1CC29F" />
        </View>
      ) : activities.length === 0 ? (
        <View className="flex-1 justify-center items-center opacity-50 pb-20">
          <Text className="text-6xl mb-4">📝</Text>
          <Text className="text-lg font-bold text-text mb-2">Henüz Aktivite Yok</Text>
          <Text className="text-sm text-muted text-center max-w-[250px]">
            Bir gruba fatura eklediğinizde tüm harcamalar burada listelenecek.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View 
              className="flex-row p-5 bg-card rounded-[24px] mb-4 shadow-sm items-center border border-border"
              style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : { elevation: 1 }}
            >
              <View className="w-12 h-12 bg-background rounded-full mr-4 justify-center items-center border border-border">
                <Text className="text-2xl">📝</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-baseline mb-1">
                  <Text className="text-lg font-bold text-text tracking-tight">{item.expense}</Text>
                </View>
                <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">{item.group}</Text>
                <Text className="text-muted text-xs">{item.date}</Text>
              </View>
              <View className="items-end">
                <Text className={`text-sm font-medium ${item.type === 'paid' ? 'text-primary' : 'text-secondary'}`}>
                  {item.description}
                </Text>
                <Text className={`font-extrabold text-xl mt-1 ${item.type === 'paid' ? 'text-primary' : 'text-secondary'}`}>
                  {item.amount}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
