import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

const GROUP_ICONS = ['👥', '🏡', '✈️', '🍔', '🐶', '🐱', '🦉', '🚗', '🎭', '💼'];

export default function NewGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Diğer');
  const [selectedIcon, setSelectedIcon] = useState('👥');
  const [loading, setLoading] = useState(false);

  const categories = ['Sevgili', 'Ev', 'Gezi', 'Diğer'];

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Lütfen bir grup adı girin.');
      return;
    }
    
    if (!user) {
      Alert.alert('Hata', 'Oturum açık değil.');
      return;
    }

    setLoading(true);
    
    // Insert new group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ 
        name, 
        category, 
        avatar_url: selectedIcon, // Save the selected emoji as the avatar
        created_by: user.id 
      })
      .select()
      .single();

    if (groupError) {
      Alert.alert('Hata', groupError.message);
      setLoading(false);
      return;
    }

    // Add user as a group member
    if (group) {
        const { error: memberError } = await supabase
          .from('group_members')
          .insert({ group_id: group.id, user_id: user.id });
        
        if (memberError) console.warn(memberError.message);
    }
    
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView className="flex-1 bg-background px-6 pt-16">
      <View className="flex-row items-center justify-between mb-8">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Text className="text-muted text-lg font-medium">İptal</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-extrabold text-text tracking-tight">Yeni Grup</Text>
        <View className="w-12" />
      </View>

      <View className="items-center mb-8">
        <View className="w-24 h-24 bg-primary/10 rounded-full justify-center items-center mb-4 border-2 border-primary/20">
          <Text className="text-5xl text-primary font-bold">
            {selectedIcon}
          </Text>
        </View>
        <Text className="text-muted font-bold text-xs uppercase tracking-widest mb-3">Grup İkonu Seç</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-2" contentContainerStyle={{ paddingHorizontal: 10 }}>
          {GROUP_ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              onPress={() => setSelectedIcon(icon)}
              className={`w-12 h-12 rounded-full justify-center items-center mx-2 ${selectedIcon === icon ? 'bg-primary/20 border-2 border-primary' : 'bg-card border border-border'}`}
            >
              <Text className="text-2xl">{icon}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Text className="text-muted font-bold text-xs uppercase tracking-widest mb-2 ml-1">Grup Adı</Text>
      <TextInput
        className="bg-card w-full border border-border rounded-2xl px-5 py-4 mb-8 text-text text-xl font-bold shadow-sm"
        placeholder="Örn: Ev Kirası"
        placeholderTextColor="#999999"
        value={name}
        onChangeText={setName}
        style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : { elevation: 1 }}
      />

      <Text className="text-muted font-bold text-xs uppercase tracking-widest mb-3 ml-1">Kategori (İsteğe Bağlı)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-12" contentContainerStyle={{ paddingRight: 20 }}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            className={`px-6 py-3 rounded-full border mr-3 mt-1 shadow-sm ${category === cat ? 'bg-primary border-primary' : 'bg-card border-border'}`}
            onPress={() => setCategory(cat)}
            style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 } : { elevation: 1 }}
          >
            <Text className={`text-center font-bold text-base tracking-wide ${category === cat ? 'text-white' : 'text-text'}`}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity 
        className="bg-primary shadow-lg flex-row justify-center items-center rounded-full py-5 mb-10"
        onPress={handleCreateGroup}
        disabled={loading}
        style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 } : { elevation: 8 }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-extrabold text-xl tracking-wide">Oluştur</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
