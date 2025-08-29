-- Corrective migration: Properly secure places and raw_places tables

-- Completely remove all existing policies for places table
DROP POLICY IF EXISTS "places select anon" ON public.places;
DROP POLICY IF EXISTS "p_select_ok_public" ON public.places;
DROP POLICY IF EXISTS "authenticated_users_can_view_places" ON public.places;
DROP POLICY IF EXISTS "authenticated_users_can_update_places" ON public.places;
DROP POLICY IF EXISTS "authenticated_users_can_insert_places" ON public.places;

-- Completely remove all existing policies for raw_places table
DROP POLICY IF EXISTS "Allow anon read raw_places" ON public.raw_places;
DROP POLICY IF EXISTS "authenticated_users_can_view_raw_places" ON public.raw_places;
DROP POLICY IF EXISTS "authenticated_users_can_update_raw_places" ON public.raw_places;
DROP POLICY IF EXISTS "authenticated_users_can_insert_raw_places" ON public.raw_places;

-- Create new secure policies for places table (only authenticated users)
CREATE POLICY "secure_places_select" ON public.places FOR SELECT TO authenticated USING (true);
CREATE POLICY "secure_places_insert" ON public.places FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "secure_places_update" ON public.places FOR UPDATE TO authenticated USING (true);
CREATE POLICY "secure_places_delete" ON public.places FOR DELETE TO authenticated USING (true);

-- Create new secure policies for raw_places table (only authenticated users)
CREATE POLICY "secure_raw_places_select" ON public.raw_places FOR SELECT TO authenticated USING (true);
CREATE POLICY "secure_raw_places_insert" ON public.raw_places FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "secure_raw_places_update" ON public.raw_places FOR UPDATE TO authenticated USING (true);
CREATE POLICY "secure_raw_places_delete" ON public.raw_places FOR DELETE TO authenticated USING (true);