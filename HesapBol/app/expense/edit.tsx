import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function EditExpenseScreen() {
  const router = useRouter();
  const { expenseId } = useLocalSearchParams();
  const { session } = useAuth();
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [originalPayer, setOriginalPayer] = useState('');

  useEffect(() => {
    if (expenseId) {
      fetchExpenseData();
    }
  }, [expenseId]);

  const fetchExpenseData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('description, amount, paid_by')
        .eq('id', expenseId)
        .single();
        
      if (error) throw error;
      if (data) {
        setDescription(data.description);
        setAmount(data.amount.toString().replace('.', ','));
        setOriginalPayer(data.paid_by);
      }
    } catch (e) {
      Alert.alert('Hata', 'Fatura bilgileri alınamadı.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (text: string) => {
    const cleanText = text.replace(/[^0-9.,]/g, '');
    const match = cleanText.match(/[.,]/g);
    if (match && match.length > 1) {
      return amount; 
    }
    return cleanText;
  };

  const handleUpdate = async () => {
    if (!description || !amount) {
      Alert.alert('Eksik Bilgi', 'Lütfen açıklama ve tutar girin.');
      return;
    }
    
    // Sadece asıl ödeyen kişi düzenleyebilsin (Güvenlik / RLS de zaten bunu kısıtlıyor)
    if (originalPayer !== session?.user?.id) {
       Alert.alert('Yetkisiz İşlem', 'Sadece bu faturayı ekleyen / ödeyen kişi düzenleme yapabilir.');
       return;
    }

    try {
      setSaving(true);
      const numericAmount = parseFloat(amount.replace(/,/g, '.'));

      // 1. Update the Expense
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ description, amount: numericAmount })
        .eq('id', expenseId);

      if (updateError) throw updateError;

      // 2. Recalculate and Update Splits
      const { data: splits, error: splitsFetchError } = await supabase
        .from('expense_splits')
        .select('id')
        .eq('expense_id', expenseId);

      if (splitsFetchError) throw splitsFetchError;

      if (splits && splits.length > 0) {
        const newSplitAmount = numericAmount / splits.length;
        
        // Update all splits
        const updatePromises = splits.map(split => 
          supabase
            .from('expense_splits')
            .update({ amount_owed: newSplitAmount })
            .eq('id', split.id)
        );
        
        await Promise.all(updatePromises);
      }

      router.back();
    } catch (error: any) {
      console.error('Update error:', error);
      Alert.alert('Hata', error.message || 'Fatura güncellenirken bir sorun oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
     if (originalPayer !== session?.user?.id) {
       Alert.alert('Yetkisiz İşlem', 'Sadece bu faturayı ekleyen / ödeyen kişi faturayı silebilir.');
       return;
     }

    Alert.alert(
      'Faturayı Sil',
      'Bu faturayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
           text: 'Sil',
           style: 'destructive',
           onPress: async () => {
              try {
                 setDeleting(true);
                 const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
                 if (error) throw error;
                 router.back();
              } catch (e: any) {
                 Alert.alert('Hata', e.message || 'Fatura silinemedi.');
                 setDeleting(false);
              }
           }
        }
      ]
    );
  };

  const isOwner = originalPayer === session?.user?.id;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background pt-14"
    >
      <View className="flex-row items-center justify-between px-6 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Text className="text-muted text-lg font-medium">İptal</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text tracking-tight">Faturayı Düzenle</Text>
        
        {isOwner ? (
          <TouchableOpacity onPress={handleUpdate} disabled={saving || deleting || loading} className="p-2 -mr-2">
            {saving ? (
              <ActivityIndicator color="#1CC29F" size="small" />
            ) : (
              <Text className="text-primary text-lg font-bold">Kaydet</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View className="p-2 -mr-2 opacity-50"><Text className="text-muted text-lg font-bold">Kaydet</Text></View>
        )}
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#1CC29F" size="large" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
          {!isOwner && (
             <View className="bg-secondary/10 p-4 rounded-xl mb-6 border border-secondary/20">
                <Text className="text-secondary text-sm font-bold text-center">Bu faturayı siz ödemediğiniz için düzenleme veya silme işlemi yapamazsınız.</Text>
             </View>
          )}

          {/* Amount Input */}
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
                onChangeText={(text) => setAmount(formatAmount(text))}
                editable={isOwner}
                selectionColor="#1CC29F"
              />
            </View>
          </View>

          {/* Description Input */}
          <Text className="text-muted uppercase text-xs font-bold mb-3 tracking-wider ml-2">Açıklama</Text>
          <TextInput
            className="bg-card w-full rounded-[20px] px-6 py-5 mb-8 text-text text-lg shadow-sm border border-border"
            placeholder="Neye harcadınız?"
            placeholderTextColor="#999999"
            value={description}
            onChangeText={setDescription}
            editable={isOwner}
            style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : { elevation: 1 }}
          />

          {isOwner && (
             <TouchableOpacity 
                className="bg-secondary/10 w-full h-14 rounded-full flex-row justify-center items-center mt-6 border border-secondary/20"
                onPress={handleDelete}
                disabled={deleting || saving}
             >
                {deleting ? (
                   <ActivityIndicator color="#FF6B6B" size="small" />
                ) : (
                   <Text className="text-secondary font-extrabold text-lg tracking-wide">Faturayı Sil</Text>
                )}
             </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
