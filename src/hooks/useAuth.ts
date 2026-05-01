import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  isApproved: boolean;
  role: string;
  fullName?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_settings')
      .select('is_approved, role, full_name')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data
      ? { isApproved: data.is_approved ?? false, role: data.role ?? 'user', fullName: data.full_name ?? undefined }
      : { isApproved: false, role: 'user' }
    );
  }, []);

  useEffect(() => {
    // Reactive: handle sign-in / sign-out events after initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    // Initial load: wait for profile before clearing loading spinner
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return {
    user,
    session,
    loading,
    profile,
    isApproved: profile?.isApproved ?? false,
    isAdmin: profile?.role === 'admin',
    signOut,
    refreshProfile: () => user ? loadProfile(user.id) : Promise.resolve(),
  };
}
