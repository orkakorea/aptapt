// src/lib/supabase.ts
// 단일 인스턴스만 사용하도록, integrations의 supabase를 그대로 재노출합니다.
// 이 파일에서는 절대 createClient(...)를 호출하지 않습니다.
export { supabase } from "@/integrations/supabase/client";
