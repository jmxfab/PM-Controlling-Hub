import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

async function getHeroUser(): Promise<{ heroUserId: string; email: string | null } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);

  const { data: notifs } = await supabase
    .from("hero_notifications")
    .select("hero_user_id")
    .eq("is_deleted", false)
    .not("hero_user_id", "is", null)
    .limit(1);

  const heroUserId = notifs?.[0]?.hero_user_id as string | undefined;
  if (!heroUserId) return null;

  const { data: histories } = await supabase
    .from("hero_histories")
    .select("user_email")
    .contains("raw", { user: { id: parseInt(heroUserId, 10) } })
    .not("user_email", "is", null)
    .limit(1);

  return {
    heroUserId,
    email: (histories?.[0]?.user_email as string | undefined) ?? null,
  };
}

function formatNameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const parts = local.split(".");
  if (parts.length >= 2) {
    const initial = parts[0].charAt(0).toUpperCase() + ".";
    const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${initial} ${lastName}`;
  }
  return local;
}

export async function UserCard() {
  const user = await getHeroUser().catch(() => null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benutzer</CardTitle>
        <CardDescription>
          Der Hero-Benutzer für den dieses Dashboard konfiguriert ist.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <User size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-0.5">
              {user.email && (
                <p className="text-sm font-medium">{formatNameFromEmail(user.email)}</p>
              )}
              <p className="text-sm text-muted-foreground">{user.email ?? "–"}</p>
              <p className="text-xs text-muted-foreground font-mono">Hero User ID: {user.heroUserId}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Kein Benutzer gefunden.</p>
        )}
      </CardContent>
    </Card>
  );
}
