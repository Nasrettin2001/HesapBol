import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Eksik Bilgi', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        Alert.alert('Kayıt Hatası', error.message);
      } else {
        Alert.alert('Başarılı', 'Lütfen hesabınızı onaylamak için e-postanızı kontrol edin.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        Alert.alert('Giriş Hatası', error.message);
      }
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background justify-center px-6"
    >
      <View className="items-center mb-12 mt-10">
        <View className="w-24 h-24 bg-primary/10 rounded-[32px] items-center justify-center mb-6" style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 } : { elevation: 2 }}>
          <Text className="text-5xl">🌱</Text>
        </View>
        <Text className="text-text text-5xl font-extrabold mb-3 tracking-tighter">HesapBöl</Text>
        <Text className="text-muted text-lg tracking-wide">Harcamalarını kolayca yönet</Text>
      </View>

      <View className="bg-card w-full rounded-[32px] p-8 shadow-sm border border-border" style={Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 } : { elevation: 3 }}>
        <Text className="text-muted font-bold mb-2 ml-2 text-xs uppercase tracking-widest">E-posta</Text>
        <View className="bg-background border border-border rounded-2xl mb-6 shadow-sm overflow-hidden flex-row items-center px-5 h-14">
          <Feather name="mail" size={20} color="#A0A0A0" className="mr-3" />
          <TextInput
            className="flex-1 text-text text-base h-full py-0"
            placeholder="E-posta adresinizi girin"
            placeholderTextColor="#A0A0A0"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <Text className="text-muted font-bold mb-2 ml-2 text-xs uppercase tracking-widest">Şifre</Text>
        <View className="bg-background border border-border rounded-2xl mb-10 shadow-sm overflow-hidden flex-row items-center px-5 h-14">
          <Feather name="lock" size={20} color="#A0A0A0" className="mr-3" />
          <TextInput
            className="flex-1 text-text text-base h-full py-0 pr-10"
            placeholder="Şifrenizi girin"
            placeholderTextColor="#A0A0A0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity 
            className="absolute right-0 top-0 bottom-0 justify-center px-5"
            onPress={() => setShowPassword(!showPassword)}
          >
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6C6C80" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          className="bg-primary flex-row justify-center items-center rounded-2xl py-5 mb-2"
          onPress={handleAuth}
          disabled={loading}
          style={Platform.OS === 'ios' ? { shadowColor: '#1CC29F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 } : { elevation: 8 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-xl tracking-wide">
              {isSignUp ? 'Kayıt Ol' : 'Giriş Yap'}
            </Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-muted font-medium">
            {isSignUp ? 'Zaten hesabınız var mı? ' : 'Hesabınız yok mu? '}
          </Text>
          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
            <Text className="text-primary font-bold">
              {isSignUp ? 'Giriş Yap' : 'Kayıt Ol'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
