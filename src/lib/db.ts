import { supabase } from "@/integrations/supabase/client";
// Loose-typed client for tables whose generated types haven't synced yet.
export const db = supabase as unknown as {
  from: (table: string) => any;
  storage: typeof supabase.storage;
  auth: typeof supabase.auth;
  channel: typeof supabase.channel;
};
