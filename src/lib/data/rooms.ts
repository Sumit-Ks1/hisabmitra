import "server-only";
import type { Bed, RoomRow } from "@/lib/db-types";
import type { Workspace } from "./workspace";

export type Occupant = { tenantId: string; name: string; bedId: string; roomId: string; since: string };
export type RoomStatus = "available" | "partial" | "full" | "maintenance";

export function roomStatus(r: Pick<RoomRow, "maintenance" | "bed_count" | "occupied_count">): RoomStatus {
  if (r.maintenance) return "maintenance";
  if (r.occupied_count === 0) return "available";
  return r.occupied_count >= r.bed_count ? "full" : "partial";
}

/** Rooms, beds and who is currently on each bed, for the selected building. */
export async function getRoomMap(ws: Pick<Workspace, "supabase" | "userId" | "building">) {
  const { supabase, userId, building } = ws;
  const [roomsRes, bedsRes, allocRes] = await Promise.all([
    supabase.from("v_rooms").select("*").eq("building_id", building.id).eq("owner_id", userId).order("floor_number").order("name"),
    supabase.from("beds").select("id, room_id, label, monthly_rent").eq("building_id", building.id).eq("owner_id", userId).is("deleted_at", null).order("label"),
    supabase.from("room_allocations").select("tenant_id, bed_id, room_id, started_on, tenants(full_name)").eq("building_id", building.id).eq("owner_id", userId).is("ended_on", null),
  ]);
  const rooms = (roomsRes.data ?? []) as RoomRow[];
  const beds = (bedsRes.data ?? []) as Bed[];
  const occupants: Occupant[] = (allocRes.data ?? []).map((a) => {
    const t = (Array.isArray(a.tenants) ? a.tenants[0] : a.tenants) as { full_name: string } | null;
    return { tenantId: a.tenant_id as string, bedId: a.bed_id as string, roomId: a.room_id as string, since: a.started_on as string, name: t?.full_name ?? "—" };
  });
  rooms.sort((a, b) => a.floor_number - b.floor_number || a.name.localeCompare(b.name, undefined, { numeric: true }));
  beds.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return { rooms, beds, occupants };
}
