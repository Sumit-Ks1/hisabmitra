import Link from "next/link";
import { ArrowLeftRight, BedDouble, Wrench } from "lucide-react";
import { AddRoomDialog, BulkRoomsDialog } from "@/components/app/room-forms";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { getRoomMap, roomStatus, type RoomStatus } from "@/lib/data/rooms";
import { getSubscription, getWorkspace } from "@/lib/data/workspace";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rooms" };

const TONE: Record<RoomStatus, string> = {
  available: "border-success-500/40 bg-success-50",
  partial: "border-warm-400/60 bg-warm-50",
  full: "border-slate-200 bg-white",
  maintenance: "border-slate-200 bg-slate-100",
};

export default async function RoomsPage() {
  const ws = await getWorkspace();
  const { t, building } = ws;
  const [{ rooms, occupants }, sub] = await Promise.all([getRoomMap(ws), getSubscription(ws)]);
  const perBed = building.rent_basis === "bed";
  const limit = ws.owner.room_limit ?? sub?.rooms_count ?? building.rooms_count;
  const atLimit = rooms.length >= limit;

  const floors = [...new Set(rooms.map((r) => r.floor_number))];
  const label: Record<RoomStatus, string> = {
    available: t("Available", "Khaali"),
    partial: t("Partly occupied", "Thoda bhara"),
    full: t("Full", "Poora bhara"),
    maintenance: t("Maintenance", "Maintenance"),
  };
  const freeBeds = rooms.filter((r) => !r.maintenance).reduce((a, r) => a + Math.max(0, r.bed_count - r.occupied_count), 0);

  return (
    <div>
      <PageHeader
        title={t("Rooms", "Rooms")}
        subtitle={t(`${rooms.length} of ${limit} rooms · ${freeBeds} beds free`, `${limit} mein se ${rooms.length} rooms · ${freeBeds} beds khaali`)}
        action={!atLimit && rooms.length > 0 ? <AddRoomDialog buildingId={building.id} perBed={perBed} defaultFloor={floors.at(-1) ?? 1} /> : undefined}
      />

      {atLimit && (
        <Notice tone="warm" className="mb-4" title={t("Room limit reached", "Room limit poori ho gayi")}>
          {t(`Your plan covers ${limit} rooms. Contact support to add more.`, `Aapke plan mein ${limit} rooms hain. Aur rooms ke liye support se baat karein.`)}
        </Notice>
      )}

      {rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={t("No rooms yet", "Abhi koi room nahi")}
          body={t("Use Quick setup to create all floors and rooms in one go, or add rooms one by one.", "Jaldi setup se saare floors aur rooms ek saath banayein, ya ek-ek karke jodein.")}
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <BulkRoomsDialog buildingId={building.id} perBed={perBed} roomsLeft={limit - rooms.length} primary />
              <AddRoomDialog buildingId={building.id} perBed={perBed} defaultFloor={1} />
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {occupants.length >= 2 && (
              <LinkButton href="/app/rooms/swap" variant="outline" size="sm">
                <ArrowLeftRight aria-hidden /> {t("Swap rooms", "Rooms swap karein")}
              </LinkButton>
            )}
            {!atLimit && <BulkRoomsDialog buildingId={building.id} perBed={perBed} roomsLeft={limit - rooms.length} />}
          </div>

          <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-slate-600" aria-label="Legend">
            {(["available", "partial", "full", "maintenance"] as RoomStatus[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded border", TONE[s])} aria-hidden /> {label[s]}
              </li>
            ))}
          </ul>

          <div className="space-y-6">
            {floors.map((f) => {
              const list = rooms.filter((r) => r.floor_number === f);
              return (
                <section key={f} aria-labelledby={`floor-${f}`}>
                  <h2 id={`floor-${f}`} className="mb-2.5 text-[0.85rem] font-semibold uppercase tracking-wide text-slate-500">
                    {f === 0 ? t("Ground floor", "Ground floor") : t(`Floor ${f}`, `Floor ${f}`)}
                  </h2>
                  <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {list.map((r) => {
                      const st = roomStatus(r);
                      return (
                        <li key={r.id}>
                          <Link href={`/app/rooms/${r.id}`} className={cn("block rounded-2xl border p-3.5 transition-shadow hover:shadow-lift", TONE[st])}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-lg font-semibold leading-tight text-ink">{r.name}</p>
                              {st === "maintenance" && <Wrench className="size-4 shrink-0 text-slate-500" aria-hidden />}
                            </div>
                            <p className="mt-0.5 text-[0.8rem] text-slate-600">
                              {inr(r.monthly_rent)}
                              {perBed ? t("/bed", "/bed") : ""}
                            </p>
                            <div className="mt-2.5 flex flex-wrap gap-1" aria-hidden>
                              {Array.from({ length: Math.min(r.bed_count, 12) }, (_, i) => (
                                <span key={i} className={cn("h-2.5 w-5 rounded-full", i < r.occupied_count ? "bg-ink" : "border border-slate-400 bg-white")} />
                              ))}
                            </div>
                            <p className="mt-1.5 text-[0.78rem] font-medium text-slate-700">
                              {st === "maintenance" ? label.maintenance : t(`${r.occupied_count}/${r.bed_count} beds filled`, `${r.occupied_count}/${r.bed_count} beds bhare`)}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
