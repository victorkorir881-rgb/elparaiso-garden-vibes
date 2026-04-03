import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    const { data } = await supabase.from("site_settings").select("*").order("category").order("key");
    setSettings(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = (id: string, value: string) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const setting of settings) {
      await supabase.from("site_settings").update({ value: setting.value }).eq("id", setting.id);
    }
    setSaving(false);
    toast({ title: "Settings saved" });
  };

  const grouped = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-fire">
          <Save size={16} className="mr-2" />{saving ? "Saving..." : "Save All"}
        </Button>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground capitalize mb-4">{category}</h2>
              <div className="grid gap-4">
                {items.map((s) => (
                  <div key={s.id} className="grid grid-cols-3 gap-4 items-center">
                    <Label className="capitalize">{s.key.replace(/_/g, " ")}</Label>
                    <Input className="col-span-2" value={s.value} onChange={(e) => updateSetting(s.id, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {settings.length === 0 && <p className="text-muted-foreground text-center py-8">No settings configured. Run the seed SQL to populate defaults.</p>}
        </div>
      )}
    </AdminLayout>
  );
}
