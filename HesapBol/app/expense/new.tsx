import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function NewExpenseScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(true);
  
  const [members, setMembers] = useState<any[]>([]);
  const [whoPaidList, setWhoPaidList] = useState<string[]>([]); 
  const [membersInvolved, setMembersInvolved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (groupId) {
      // Validate UUID length to avoid crash from previously cached static ID '1'
      if (String(groupId).length === 36) {
        fetchMembers();
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [groupId]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('group_members')
      .select('user_id, users(name, email)')
      .eq('group_id', groupId);
      
    if (error) console.error("Error fetching members:", error.message);
    
    if (data) {
      setMembers(data);
      if (user) setWhoPaidList([user.id]);
      
      const initialInvolved: Record<string, boolean> = {};
      data.forEach(m => {
        initialInvolved[m.user_id] = true;
      });
      setMembersInvolved(initialInvolved);
    }
    setFetchingMembers(false);
  };

  const formatAmount = (text: string) => {
    // Only allow numbers, comma and dot
    const cleanText = text.replace(/[^0-9.,]/g, '');
    
    // Prevent multiple commas/dots
    const match = cleanText.match(/[.,]/g);
    if (match && match.length > 1) {
      return amount; // Keep previous value if user types a second separator
    }
    
    return cleanText;
  };

  const handleAmountChange = (text: string) => {
    setAmount(formatAmount(text));
  };

  const handleTogglePayer = (memberId: string) => {
    setWhoPaidList(prev => {
      if (prev.includes(memberId)) {
         return prev.filter(id => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const handleToggleMember = (memberId: string) => {
    setMembersInvolved(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  const handleAddExpense = async () => {
    if (!description || !amount) {
      Alert.alert('Eksik Bilgi', 'Lütfen açıklama ve tutar girin.');
      return;
    }

    const involvedCount = Object.values(membersInvolved).filter(Boolean).length;
    if (involvedCount === 0) {
      Alert.alert('Hata', 'Hesaba en az 1 kişi dahil edilmelidir.');
      return;
    }
    
    if (whoPaidList.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir ödeyen kişi seçin.');
      return;
    }

    setLoading(true);
    
    // Sadece virgülleri asıl ondalık ayırıcı olan noktaya çevirerek ayrıştırıyoruz.
    // Eğer format 38.50 ise aynen kalır, 38,50 ise 38.50'ye döner.
    const totalNumericAmount = parseFloat(amount.replace(/,/g, '.'));
    
    // Ne kadar kişi ödediyse toplam tutarı o kadar fatura kalemi olarak böleceğiz
    const amountPerPayer = totalNumericAmount / whoPaidList.length;

    try {
      // Create an array to hold the newly inserted base expenses
      const expenseInsertions = whoPaidList.map(payerId => ({
        group_id: groupId,
        paid_by: payerId,
        description: whoPaidList.length > 1 ? `${description} (${whoPaidList.length} Ortak Ödeme)` : description,
        amount: amountPerPayer,
      }));

      // 1. Insert multiple Expenses (one for each payer)
      const { data: insertedExpenses, error: expensesError } = await supabase
        .from('expenses')
        .insert(expenseInsertions)
        .select();

      if (expensesError || !insertedExpenses) {
        throw expensesError || new Error("Harcamalar oluşturulamadı");
      }

      // 2. Prepare ALL splits to insert at once across all new expenses.
      // Every expense is split amongst all involved members.
      const splitsToInsert: any[] = [];
      
      // Calculate how much of the (divided) expense each involved person owes
      const splitAmountPerInvolved = amountPerPayer / involvedCount;

      for (const expense of insertedExpenses) {
        Object.entries(membersInvolved)
          .filter(([_, isIncluded]) => isIncluded)
          .forEach(([userId]) => {
            splitsToInsert.push({
              expense_id: expense.id,
              user_id: userId,
              amount_owed: splitAmountPerInvolved,
              is_settled: userId === expense.paid_by // Auto-settle their share for THIS specific expense
            });
          });
      }

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) throw splitsError;

      router.back();

    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Hata', error.message || 'Fatura kaydedilirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (m: any) => {
    if (m.user_id === user?.id) return 'Siz';
    return m.users?.name || m.users?.email?.split('@')[0] || 'İsimsiz';
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background pt-14"
    >
      <View className="flex-row items-center justify-between px-6 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Text className="text-muted text-lg font-medium">İptal</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text tracking-tight">Yeni Fatura</Text>
        <TouchableOpacity onPress={handleAddExpense} disabled={loading || fetchingMembers} className="p-2 -mr-2">
          {loading ? (
            <ActivityIndicator color="#1CC29F" size="small" />
          ) : (
            <Text className="text-primary text-lg font-bold">Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* Large Amount Input */}
        <View className="items-center mb-10 mt-6">
          <Text className="text-muted font-medium mb-3 uppercase tracking-wider text-xs">Toplam Tutar</Text>
          <View className="flex-row items-center border-b-2 border-primary/20 pb-2 px-4 shadow-sm">
            <Text className="text-5xl text-primary font-bold mr-2">₺</Text>
            <TextInput
              className="text-6xl text-text font-extrabold min-w-[120px] text-center"
              placeholder="0,00"
              placeholderTextColor="#A0A0A0"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={handleAmountChange}
              autoFocus
              selectionColor="#1CC29F"
            />
          </View>
        </View>

        {/* Clean Description Input */}
        <TextInput
          className="bg-card w-full rounded-[20px] px-6 py-5 mb-4 text-text text-lg shadow-sm border border-border"
          placeholder="Neye harcadınız? (Örn: Akşam Yemeği)"
          placeholderTextColor="#999999"
          value={description}
          onChangeText={setDescription}
          style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : { elevation: 1 }}
        />

        {/* Quick Category Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8" contentContainerStyle={{ paddingRight: 20 }}>
          {[
            { label: 'Yemek', icon: '🍽️' },
            { label: 'Market', icon: '🛒' },
            { label: 'Fırın', icon: '🥖' },
            { label: 'Kafe', icon: '☕' },
            { label: 'Benzin', icon: '⛽' },
            { label: 'Fatura', icon: '📄' }
          ].map((category, idx) => (
             <TouchableOpacity 
               key={idx}
               className="bg-primary/10 py-2 px-4 rounded-full mr-2 flex-row items-center border border-primary/20"
               onPress={() => setDescription(prev => prev ? `${prev} - ${category.label}` : category.label)}
             >
               <Text className="mr-1 text-base">{category.icon}</Text>
               <Text className="text-primary font-bold text-sm">{category.label}</Text>
             </TouchableOpacity>
          ))}
        </ScrollView>

        {fetchingMembers ? (
           <ActivityIndicator color="#1CC29F" className="my-10" />
        ) : (
          <>
            <Text className="text-muted uppercase text-xs font-bold mb-3 tracking-wider ml-2">Kimler Ödedi?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8" contentContainerStyle={{ paddingRight: 20 }}>
              {members.map((m) => {
                const isPayer = whoPaidList.includes(m.user_id);
                return (
                  <TouchableOpacity 
                    key={m.user_id}
                    onPress={() => handleTogglePayer(m.user_id)}
                    className={`py-4 px-6 rounded-full border mr-3 min-w-[100px] flex-row items-center justify-center space-x-2 ${isPayer ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}
                  >
                    {isPayer && <Text className="text-primary font-bold mr-1">✓</Text>}
                    <Text className={`text-center font-bold text-base ${isPayer ? 'text-primary' : 'text-text'}`}>
                      {getDisplayName(m)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text className="text-muted uppercase text-xs font-bold mb-3 tracking-wider ml-2">Hesaba Kimler Dahil?</Text>
            <View className="bg-card rounded-[24px] overflow-hidden shadow-sm border border-border mb-8" style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : { elevation: 1 }}>
              {members.map((m, index, array) => (
                <TouchableOpacity 
                  key={m.user_id}
                  onPress={() => handleToggleMember(m.user_id)}
                  className={`flex-row items-center justify-between py-5 px-6 ${index !== array.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <Text className="text-text font-medium text-lg">{getDisplayName(m)}</Text>
                  <View 
                    className={`w-7 h-7 rounded-full border-2 items-center justify-center ${membersInvolved[m.user_id] ? 'bg-primary border-primary' : 'bg-transparent border-border'}`}
                  >
                    {membersInvolved[m.user_id] && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
