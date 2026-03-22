import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useRouter, useSegments } from 'expo-router';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  initialized: false,
});

// Separate component that handles navigation redirect
// This runs INSIDE the navigation tree, so router hooks work safely
function AuthNavigationGuard({ children }: { children: React.ReactNode }) {
  const { session, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      hasNavigated.current = true;
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      hasNavigated.current = true;
      router.replace('/(tabs)' as any);
    }
  }, [session, initialized, segments]);

  return <>{children}</>;
}

// AuthProvider only manages auth state — NO navigation hooks here
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, initialized }}>
      <AuthNavigationGuard>
        {children}
      </AuthNavigationGuard>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
