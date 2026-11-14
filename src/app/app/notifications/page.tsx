import { NotificationList } from "@/components/app/notification-list";
import { requireOwner } from "@/lib/auth/session";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  return <NotificationList ctx={await requireOwner()} />;
}
