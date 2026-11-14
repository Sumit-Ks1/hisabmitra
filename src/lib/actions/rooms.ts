"use server";

import { revalidatePath } from "next/cache";
import { todayIST } from "@/lib/format";
import { isUuid } from "@/lib/uploads/rules";
import { bulkRoomName, bulkRoomsSchema, isoDate, roomEditSchema, roomSchema } from "@/lib/validation";
import { formToObject, must, ownerAction, validate, type ActionResult } from "./helpers";

const done = () => revalidatePath("/app", "layout");

export async function addRoomAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.building_id)) return { ok: false, error: t("Invalid building", "Building galat hai") };
    const v = validate(roomSchema, f);
    if (!v.ok) return v.result;
    must(
      await supabase.rpc("add_room", {
        p_building: f.building_id, p_floor_number: v.data.floor, p_name: v.data.name, p_room_type: v.data.room_type,
        p_beds: v.data.beds, p_rent: v.data.rent, p_deposit: v.data.deposit, p_notes: v.data.notes || null,
      }),
    );
    done();
    return { ok: true, message: t("Room added", "Room jud gaya") };
  });
}

/** Quick setup: e.g. 3 floors × 4 rooms → 101–104, 201–204, 301–304. */
export async function bulkAddRoomsAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.building_id)) return { ok: false, error: t("Invalid building", "Building galat hai") };
    const v = validate(bulkRoomsSchema, f);
    if (!v.ok) return v.result;
    const d = v.data;
    const rooms = [];
    for (let i = 0; i < d.floors; i++) {
      const floor = d.start_floor + i;
      for (let n = 1; n <= d.rooms_per_floor; n++) {
        rooms.push({ floor, name: bulkRoomName(floor, n), room_type: d.room_type, beds: d.beds, rent: d.rent, deposit: d.deposit });
      }
    }
    const n = must(await supabase.rpc("bulk_add_rooms", { p_building: f.building_id, p_rooms: rooms })) as number;
    done();
    return { ok: true, message: t(`${n} rooms added`, `${n} rooms jud gaye`) };
  });
}

export async function updateRoomAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(roomEditSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const d = v.data;
    const res = await supabase
      .from("rooms")
      .update({
        name: d.name,
        room_type: d.room_type,
        monthly_rent: d.monthly_rent,
        security_deposit: d.security_deposit,
        maintenance: d.maintenance === "on",
        notes: d.notes || null,
        meter_number: d.meter_number || null,
        meter_type: d.meter_type || null,
        meter_initial_reading: d.meter_initial_reading ?? 0,
      })
      .eq("id", d.id)
      .eq("owner_id", userId);
    if (res.error?.code === "23505") return { ok: false, error: t("A room with this number already exists.", "Is number ka room pehle se hai.") };
    must(res);
    done();
    return { ok: true, message: t("Room saved", "Room save ho gaya") };
  });
}

export async function deleteRoomAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const id = String(fd.get("id") ?? "");
    if (!isUuid(id)) return { ok: false, error: t("Room not found", "Room nahi mila") };
    // soft delete; the database refuses if anyone is staying in the room
    must(await supabase.from("rooms").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("owner_id", userId));
    done();
    return { ok: true, message: t("Room removed", "Room hata diya") };
  });
}

export async function addBedAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const roomId = String(fd.get("room_id") ?? "");
    if (!isUuid(roomId)) return { ok: false, error: t("Room not found", "Room nahi mila") };
    const { data: room } = await supabase.from("rooms").select("id, building_id").eq("id", roomId).eq("owner_id", userId).maybeSingle();
    if (!room) return { ok: false, error: t("Room not found", "Room nahi mila") };
    const { data: beds } = await supabase.from("beds").select("label").eq("room_id", roomId).is("deleted_at", null);
    const used = new Set((beds ?? []).map((b) => (b.label as string).toLowerCase()));
    if (used.size >= 30) return { ok: false, error: t("Maximum 30 beds per room", "Ek room mein maximum 30 beds") };
    let n = used.size + 1;
    while (used.has(`bed ${n}`)) n++;
    must(await supabase.from("beds").insert({ owner_id: userId, building_id: room.building_id, room_id: roomId, label: `Bed ${n}` }));
    done();
    return { ok: true, message: t("Bed added", "Bed jud gaya") };
  });
}

export async function removeBedAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const id = String(fd.get("id") ?? "");
    if (!isUuid(id)) return { ok: false, error: t("Bed not found", "Bed nahi mila") };
    must(await supabase.from("beds").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("owner_id", userId));
    done();
    return { ok: true, message: t("Bed removed", "Bed hata diya") };
  });
}

export async function allocateBedAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.tenant_id) || !isUuid(f.bed_id)) return { ok: false, error: t("Choose a tenant and a bed", "Tenant aur bed chunein") };
    const date = isoDate.safeParse(f.date).success ? f.date : todayIST();
    must(await supabase.rpc("allocate_bed", { p_tenant: f.tenant_id, p_bed: f.bed_id, p_date: date }));
    done();
    return { ok: true, message: t("Room allocated", "Room allocate ho gaya") };
  });
}

export async function swapBedsAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.tenant_a) || !isUuid(f.tenant_b) || f.tenant_a === f.tenant_b) {
      return { ok: false, error: t("Choose two different tenants", "Do alag tenants chunein") };
    }
    must(await supabase.rpc("swap_beds", { p_tenant_a: f.tenant_a, p_tenant_b: f.tenant_b, p_date: todayIST() }));
    done();
    return { ok: true, message: t("Rooms swapped", "Rooms swap ho gaye") };
  });
}
