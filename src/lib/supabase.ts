import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Re-export the main client
export { supabase };

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// Common query helpers
export const getPlaces = async (limit?: number) => {
  const query = supabase
    .from('places')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (limit) {
    query.limit(limit);
  }
  
  return query;
};

export const getRawPlaces = async (limit?: number) => {
  const query = supabase
    .from('raw_places')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (limit) {
    query.limit(limit);
  }
  
  return query;
};

export const getPlacesForMap = async () => {
  return supabase
    .from('raw_places')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null);
};

// Auth helpers
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Storage helpers
export const uploadFile = async (bucket: string, path: string, file: File) => {
  return supabase.storage
    .from(bucket)
    .upload(path, file);
};

export const getPublicUrl = (bucket: string, path: string) => {
  return supabase.storage
    .from(bucket)
    .getPublicUrl(path);
};