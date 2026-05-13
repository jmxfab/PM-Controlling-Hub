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
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Benutzer</CardTitle>
        <CardDescription className="text-xs">
          Der Hero-Benutzer für den dieses Dashboard konfiguriert ist
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-950/50 dark:to-violet-950/50 ring-1 ring-border">
              <User size={22} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              {user.email && (
                <p className="text-base font-semibold">{formatNameFromEmail(user.email)}</p>
              )}
              <p className="text-sm text-muted-foreground truncate">{user.email ?? "–"}</p>
              <p className="text-[11px] text-muted-foreground/70 font-mono">Hero User ID: {user.heroUserId}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Kein Benutzer gefunden.</p>
        )}
      </CardContent>
    </Card>
  );
}
