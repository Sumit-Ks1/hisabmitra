import { NotificationList } from "@/components/app/notification-list";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  return <NotificationList ctx={await requireAdmin()} />;
}
