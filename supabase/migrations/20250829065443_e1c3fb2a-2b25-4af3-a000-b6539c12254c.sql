-- Fix security vulnerability: Remove overly permissive RLS policies and implement secure access controls

-- Drop existing overly permissive policies for places table
DROP POLICY IF EXISTS "places select anon" ON public.places;
DROP POLICY IF EXISTS "p_select_ok_public" ON public.places;

-- Drop existing overly permissive policy for raw_places table  
DROP POLICY IF EXISTS "Allow anon read raw_places" ON public.raw_places;

-- Create secure RLS policies for places table
-- Only authenticated users can view places data
CREATE POLICY "authenticated_users_can_view_places" 
ON public.places 
FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can update places data
CREATE POLICY "authenticated_users_can_update_places" 
ON public.places 
FOR UPDATE 
TO authenticated 
USING (true);

-- Only authenticated users can insert places data
CREATE POLICY "authenticated_users_can_insert_places" 
ON public.places 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Create secure RLS policies for raw_places table
-- Only authenticated users can view raw_places data
CREATE POLICY "authenticated_users_can_view_raw_places" 
ON public.raw_places 
FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can update raw_places data
CREATE POLICY "authenticated_users_can_update_raw_places" 
ON public.raw_places 
FOR UPDATE 
TO authenticated 
USING (true);

-- Only authenticated users can insert raw_places data
CREATE POLICY "authenticated_users_can_insert_raw_places" 
ON public.raw_places 
FOR INSERT 
TO authenticated 
WITH CHECK (true);