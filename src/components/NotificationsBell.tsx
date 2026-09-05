import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { fetchInbox, markAllRead, markRead, subscribeInbox, type InboxItem } from "@/lib/inbox";
import { notify } from "@/lib/notifications";

export function NotificationsBell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchInbox(user.id).then(setItems);
    const unsub = subscribeInbox(user.id, (row) => {
      setItems((prev) => [row, ...prev.filter((p) => p.id !== row.id)].slice(0, 30));
      notify(row.title, row.body ?? "", row.url ?? undefined);
    });
    return () => unsub();
  }, [user?.id]);

  const unread = items.filter((i) => !i.read).length;

  // شارة على أيقونة التطبيق في شاشة الهاتف (بدون فتح التطبيق)
  useEffect(() => {
    const n = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unread > 0) n.setAppBadge?.(unread).catch(() => {});
    else n.clearAppBadge?.().catch(() => {});
  }, [unread]);

  async function handleClick(it: InboxItem) {
    if (!it.read) {
      await markRead(it.id);
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, read: true } : p)));
    }
    setOpen(false);
    if (it.url) nav({ to: it.url });
  }

  async function handleAllRead() {
    if (!user) return;
    await markAllRead(user.id);
    setItems((prev) => prev.map((p) => ({ ...p, read: true })));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-[70vh] overflow-hidden flex flex-col" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="text-sm font-bold">الإشعارات</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={handleAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />الكل مقروء
            </Button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {items.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">لا توجد إشعارات</p>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                onClick={() => handleClick(it)}
                className={`w-full text-right p-3 border-b hover:bg-accent/40 transition ${!it.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!it.read && <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{it.title}</p>
                    {it.body && <p className="text-xs text-muted-foreground line-clamp-2">{it.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(it.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
