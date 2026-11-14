import { ArrowLeftRight } from "lucide-react";
import { SwapForm } from "@/components/app/room-forms";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { getRoomMap } from "@/lib/data/rooms";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata = { title: "Swap rooms" };

export default async function SwapPage() {
  const ws = await getWorkspace();
  const { t } = ws;
  const { rooms, beds, occupants } = await getRoomMap(ws);
  const options = occupants
    .map((o) => ({
      tenantId: o.tenantId,
      name: o.name,
      place: `${t("Room", "Room")} ${rooms.find((r) => r.id === o.roomId)?.name ?? "?"}, ${beds.find((b) => b.id === o.bedId)?.label ?? "?"}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back="/app/rooms" title={t("Swap rooms", "Rooms swap karein")} subtitle={t("Exchange the beds of two tenants.", "Do tenants ke bed aapas mein badlein.")} />
      {options.length < 2 ? (
        <EmptyState icon={ArrowLeftRight} title={t("Need two tenants with rooms", "Do tenants ke paas room hona chahiye")} body={t("Allocate rooms to at least two tenants first.", "Pehle kam se kam do tenants ko room dein.")} />
      ) : (
        <SwapForm options={options} />
      )}
    </div>
  );
}
