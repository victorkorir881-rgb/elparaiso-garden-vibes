// Compatibility shim: re-export the Supabase-backed useAuth so legacy
// imports from "@/_core/hooks/useAuth" keep working during the migration.
export { useAuth } from "@/lib/auth";
