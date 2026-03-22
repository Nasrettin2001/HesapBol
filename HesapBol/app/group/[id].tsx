import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert, Share } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function GroupDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  
  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [myNetBalance, setMyNetBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const myId = session?.user?.id;

  useFocusEffect(
    useCallback(() => {
      if (id && String(id).length === 36) {
        fetchAll();
      } else if (id) {
        router.replace('/(tabs)');
      }
    }, [id])
  );

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchGroupDetails(),
      fetchMembers(),
      fetchExpensesAndBalances(),
    ]);
    setLoading(false);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Grubu Sil',
      'Bu grubu silmek istediğinize emin misiniz? Tüm harcamalar ve üye bilgileri kalıcı olarak silinecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('groups').delete().eq('id', id);
            if (error) {
              Alert.alert('Hata', error.message);
            } else {
              router.replace('/(tabs)');
            }
          },
        },
      ]
    );
  };

  const fetchGroupDetails = async () => {
    const { data } = await supabase
      .from('groups')
      .select('name, category, avatar_url')
      .eq('id', id)
      .single();
    if (data) setGroup(data);
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('user_id, users(name, email)')
      .eq('group_id', id);
    if (data) setMembers(data);
  };

  const fetchExpensesAndBalances = async () => {
    // Fetch all expenses with their splits
    const { data: expData } = await supabase
      .from('expenses')
      .select(`
        id, description, amount, date, paid_by,
        users:paid_by (name, email),
        expense_splits (user_id, amount_owed, is_settled)
      `)
      .eq('group_id', id)
      .order('date', { ascending: false });

    if (!expData) return;
    setExpenses(expData);

    // Calculate net balances between current user and every other member
    // For each expense: the payer is owed `amount_owed` by each person in splits (except themselves)
    const debtMap: Record<string, number> = {}; // userId -> net amount (positive = they owe me, negative = I owe them)

    for (const exp of expData) {
      const payerId = exp.paid_by;
      const splits = exp.expense_splits || [];

      for (const split of splits) {
        if (split.user_id === payerId) continue; // payer doesn't owe themselves

        if (payerId === myId) {
          // I paid, so split.user_id owes me
          debtMap[split.user_id] = (debtMap[split.user_id] || 0) + Number(split.amount_owed);
        } else if (split.user_id === myId) {
          // Someone else paid and I am in the split, so I owe them
          debtMap[payerId] = (debtMap[payerId] || 0) - Number(split.amount_owed);
        }
      }
    }

    // Convert to array for rendering
    const balanceArray = Object.entries(debtMap)
      .filter(([_, amount]) => Math.abs(amount) > 0.01)
      .map(([userId, amount]) => ({ userId, amount }));

    setBalances(balanceArray);

    // Total net balance
    const netTotal = balanceArray.reduce((sum, b) => sum + b.amount, 0);
    setMyNetBalance(netTotal);
  };

  const formatAmount = (num: number) =>
    Math.abs(num).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  const getMonthYear = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  const getMemberName = (userId: string) => {
    if (userId === myId) return 'Siz';
    const member = members.find(m => m.user_id === userId);
    return member?.users?.name || member?.users?.email?.split('@')[0] || 'Bilinmiyor';
  };

  const getMemberShortName = (userId: string) => {
    const name = getMemberName(userId);
    const parts = name.split(' ');
    if (parts.length > 1) return `${parts[0]} ${parts[1].charAt(0)}.`;
    return name;
  };

  // Group expenses by month
  const groupedExpenses = expenses.reduce((groups: Record<string, any[]>, exp) => {
    const key = getMonthYear(exp.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(exp);
    return groups;
  }, {});

  const getTotalSpent = () => expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const getExpenseMyShare = (exp: any) => {
    const mySplit = (exp.expense_splits || []).find((s: any) => s.user_id === myId);
    if (!mySplit) return 0;
    if (exp.paid_by === myId) {
      // I paid, so I lent (total - my share)
      return Number(exp.amount) - Number(mySplit.amount_owed);
    } else {
      // Someone else paid, I owe my share
      return -Number(mySplit.amount_owed);
    }
  };

  const handleShareInvite = async () => {
    try {
      // Build a deep link URL
      // E.g., hesapbol://group/join?id=123...
      const inviteUrl = `hesapbol://group/join?id=${id}`;
      
      await Share.share({
        message: `Hesaplarını kolayca bölüşmek için seni "${group?.name}" grubuna davet ediyorum! Katılmak için linke tıkla:\n\n${inviteUrl}`,
        title: 'HesapBöl Grup Daveti',
      });
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Fixed Navigation Bar */}
      <View className="pt-14 pb-3 px-6 bg-background">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Text className="text-primary text-3xl font-light">‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteGroup} className="p-2 -mr-2">
            <Text className="text-muted text-xl font-light">⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Modernized Hero Header */}
        <View className="bg-primary/5 pb-8 pt-4 px-6 rounded-b-[40px] border-b border-primary/20 mb-2 relative overflow-hidden"
          style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24 } : { elevation: 4 }}>
          
          {/* Decorative background circle */}
          <View className="absolute -right-16 -top-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          
          <View className="items-center relative z-10">
            <View className="w-24 h-24 bg-card rounded-[32px] justify-center items-center mb-4 border-2 border-primary/30"
              style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 } : { elevation: 6 }}>
              <Text className="text-5xl">
                {group?.avatar_url || '👥'}
              </Text>
            </View>
            <Text className="text-3xl font-extrabold text-text tracking-tight mb-1 text-center">
              {group?.name || 'Yükleniyor...'}
            </Text>
            
            <View className="flex-row items-center justify-center bg-card/60 px-4 py-1.5 rounded-full border border-border/50 mb-6">
              <Text className="text-muted text-xs font-bold uppercase tracking-widest">
                {members.length} ÜYE
              </Text>
            </View>

            {/* Action Buttons Row */}
            <View className="flex-row items-center justify-center w-full max-w-[320px]">
              <TouchableOpacity 
                onPress={handleShareInvite} 
                className="flex-1 bg-card py-3 px-2 rounded-[20px] items-center mr-3 border border-border/80"
                style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 } : { elevation: 2 }}
              >
                <Text className="text-lg mb-1">🔗</Text>
                <Text className="text-muted text-[10px] font-bold uppercase tracking-wider">Paylaş</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => router.push(`/group/invite?groupId=${id}`)} 
                className="flex-1 bg-primary py-3 px-2 rounded-[20px] items-center mr-3"
                style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 } : { elevation: 4 }}
              >
                <Text className="text-lg mb-1 text-white">👤+</Text>
                <Text className="text-white text-[10px] font-extrabold uppercase tracking-wider">Ekle</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push(`/group/members?groupId=${id}`)} 
                className="flex-1 bg-card py-3 px-2 rounded-[20px] items-center border border-border/80"
                style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 } : { elevation: 2 }}
              >
                <Text className="text-lg mb-1">👥</Text>
                <Text className="text-muted text-[10px] font-bold uppercase tracking-wider">Üyeler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#1CC29F" className="mt-12" size="large" />
        ) : (
          <>


            {/* ═══════ BALANCE SUMMARY CARD (Splitwise-style) ═══════ */}
            <View className="mx-6 mt-6 mb-4 bg-card rounded-[24px] border border-border overflow-hidden"
              style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 } : { elevation: 3 }}>
              
              {/* Net Balance Header */}
              <View className="px-6 pt-5 pb-4 border-b border-border/50">
                {myNetBalance > 0.01 ? (
                  <>
                    <Text className="text-primary font-extrabold text-xl tracking-tight">
                      Size toplamda ₺{formatAmount(myNetBalance)} borçları var
                    </Text>
                    <Text className="text-muted text-xs mt-1 font-medium">Alacağınız özetleniyor</Text>
                  </>
                ) : myNetBalance < -0.01 ? (
                  <>
                    <Text className="text-secondary font-extrabold text-xl tracking-tight">
                      Toplamda ₺{formatAmount(myNetBalance)} borcunuz var
                    </Text>
                    <Text className="text-muted text-xs mt-1 font-medium">Borç durumunuz özetleniyor</Text>
                  </>
                ) : (
                  <>
                    <Text className="text-text font-extrabold text-xl tracking-tight">
                      Hesaplar tamam ✓
                    </Text>
                    <Text className="text-muted text-xs mt-1 font-medium">Kimseye borcunuz yok</Text>
                  </>
                )}
              </View>

              {/* Individual Balances */}
              {balances.length > 0 ? (
                <View className="px-6 py-3">
                  {balances.map((b, idx) => (
                    <View key={b.userId} className={`flex-row items-center py-3 ${idx !== balances.length - 1 ? 'border-b border-border/30' : ''}`}>
                      <View className={`w-10 h-10 rounded-full justify-center items-center mr-3 ${b.amount > 0 ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                        <Text className={`font-bold text-base ${b.amount > 0 ? 'text-primary' : 'text-secondary'}`}>
                          {getMemberName(b.userId).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        {b.amount > 0 ? (
                          <Text className="text-text font-medium">
                            <Text className="font-bold">{getMemberShortName(b.userId)}</Text> size borçlu
                          </Text>
                        ) : (
                          <Text className="text-text font-medium">
                            <Text className="font-bold">{getMemberShortName(b.userId)}</Text>'e borcunuz var
                          </Text>
                        )}
                      </View>
                      <Text className={`font-extrabold text-lg ${b.amount > 0 ? 'text-primary' : 'text-secondary'}`}>
                        ₺{formatAmount(b.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : expenses.length > 0 ? (
                <View className="px-6 py-4">
                  <Text className="text-muted text-sm text-center">Henüz borç/alacak hesaplaması yok</Text>
                </View>
              ) : null}

              {/* Quick Stats */}
              <View className="flex-row border-t border-border/50">
                <View className="flex-1 items-center py-4 border-r border-border/50">
                  <Text className="text-muted text-[10px] font-bold uppercase tracking-widest mb-1">Toplam Harcama</Text>
                  <Text className="text-text font-extrabold text-lg">₺{formatAmount(getTotalSpent())}</Text>
                </View>
                <View className="flex-1 items-center py-4">
                  <Text className="text-muted text-[10px] font-bold uppercase tracking-widest mb-1">Harcama Sayısı</Text>
                  <Text className="text-text font-extrabold text-lg">{expenses.length}</Text>
                </View>
              </View>
            </View>

            {/* ═══════ EXPENSES LIST (Grouped by Month, Splitwise-style) ═══════ */}
            <View className="px-6 mt-4">
              {Object.entries(groupedExpenses).map(([monthYear, monthExpenses]) => (
                <View key={monthYear} className="mb-4">
                  <Text className="text-text font-extrabold text-base mb-3 tracking-tight capitalize">
                    {monthYear}
                  </Text>
                  
                  {(monthExpenses as any[]).map((expense: any, index: number) => {
                    const myShare = getExpenseMyShare(expense);
                    const isPaidByMe = expense.paid_by === myId;
                    const payerName = expense.users?.name || expense.users?.email?.split('@')[0] || 'Bilinmiyor';
                    
                    return (
                      <TouchableOpacity 
                        key={expense.id}
                        onPress={() => router.push(`/expense/edit?expenseId=${expense.id}&groupId=${id}`)}
                        className="flex-row items-center py-4 px-1"
                        style={index !== (monthExpenses as any[]).length - 1 ? { borderBottomWidth: 0.5, borderBottomColor: 'rgba(150,150,150,0.15)' } : {}}
                      >
                        {/* Date Column */}
                        <View className="w-12 items-center mr-3">
                          <Text className="text-muted text-[10px] font-bold uppercase">
                            {new Date(expense.date).toLocaleDateString('tr-TR', { month: 'short' })}
                          </Text>
                          <Text className="text-text font-extrabold text-lg">
                            {new Date(expense.date).getDate()}
                          </Text>
                        </View>

                        {/* Icon */}
                        <View className="w-11 h-11 bg-primary/10 rounded-xl items-center justify-center mr-3">
                          <Text className="text-xl">📄</Text>
                        </View>

                        {/* Content */}
                        <View className="flex-1">
                          <Text className="text-text font-bold text-base mb-0.5">{expense.description}</Text>
                          <Text className="text-muted text-xs font-medium">
                            {isPaidByMe ? 'Siz' : payerName} ödedi — ₺{formatAmount(expense.amount)}
                          </Text>
                        </View>

                        {/* My Share */}
                        <View className="items-end">
                          {Math.abs(myShare) > 0.01 ? (
                            <>
                              <Text className={`text-[11px] font-bold ${myShare > 0 ? 'text-primary' : 'text-secondary'}`}>
                                {myShare > 0 ? 'ödünç verdiniz' : 'borçlandınız'}
                              </Text>
                              <Text className={`font-extrabold text-base ${myShare > 0 ? 'text-primary' : 'text-secondary'}`}>
                                ₺{formatAmount(myShare)}
                              </Text>
                            </>
                          ) : (
                            <Text className="text-muted text-xs font-medium">dahil değil</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {expenses.length === 0 && (
                <View className="items-center justify-center py-12 bg-card rounded-3xl border border-dashed border-border mt-2">
                  <Text className="text-4xl mb-3 opacity-50">💸</Text>
                  <Text className="text-muted font-medium">Henüz harcama yok</Text>
                  <Text className="text-muted/60 text-xs mt-1 text-center px-8">Alt kısımdaki butonu kullanarak ilk faturayı ekleyin.</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <View className="absolute bottom-10 w-full px-6" style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16 } : { elevation: 8 }}>
        <TouchableOpacity 
          className="bg-primary w-full h-16 rounded-[24px] flex-row justify-center items-center"
          onPress={() => router.push(`/expense/new?groupId=${id}`)}
        >
          <Text className="text-white text-3xl font-light mr-2 mb-1">+</Text>
          <Text className="text-white font-extrabold text-lg tracking-wide">Yeni Fatura Ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
