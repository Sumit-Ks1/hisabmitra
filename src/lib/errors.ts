import type { T } from "@/lib/i18n";

/**
 * Database / RPC error codes → messages a PG owner can act on.
 * Anything not listed becomes a generic message; raw database errors are never
 * shown to users (and never contain tenant data in logs).
 */
const MESSAGES: Record<string, [en: string, hinglish: string]> = {
  BED_ALREADY_OCCUPIED: ["This bed is already occupied. Please pick another bed.", "Yeh bed pehle se bhara hua hai. Doosra bed chunein."],
  TENANT_NOT_ALLOCATED: ["Both tenants must have a room before swapping.", "Swap ke liye dono tenants ke paas room hona chahiye."],
  TENANT_NOT_ACTIVE: ["This tenant has already vacated.", "Yeh tenant pehle hi ja chuka hai."],
  ROOM_IN_MAINTENANCE: ["This room is under maintenance.", "Yeh room maintenance mein hai."],
  ROOM_NAME_TAKEN: ["A room with this number already exists.", "Is number ka room pehle se hai."],
  ROOM_LIMIT_REACHED: ["Your plan's room limit is reached. Contact support to add more rooms.", "Aapke plan ki room limit poori ho gayi hai. Aur rooms ke liye support se baat karein."],
  BUILDING_LIMIT_REACHED: ["Your plan covers the buildings you already have. Contact support to add another.", "Aapke plan mein itni hi buildings hain. Nayi building ke liye support se baat karein."],
  BED_OCCUPIED: ["A tenant is staying on this bed. Move the tenant first.", "Is bed par tenant reh raha hai. Pehle tenant ko shift karein."],
  ROOM_OCCUPIED: ["Tenants are staying in this room. Move them first.", "Is room mein tenants reh rahe hain. Pehle unhe shift karein."],
  DUPLICATE_REFERENCE: ["This transaction reference has already been used.", "Yeh transaction reference pehle hi use ho chuka hai."],
  INVALID_REFERENCE: ["Please enter a valid transaction reference (6–40 letters/digits).", "Sahi transaction reference daalein (6–40 akshar/ank)."],
  INVALID_AMOUNT: ["Please enter a valid amount.", "Sahi amount daalein."],
  INVALID_DATE: ["Please check the date.", "Date check karein."],
  READING_DECREASED: ["The new reading is lower than the previous reading. If the meter was replaced, use “Correction”.", "Nayi reading pichhli reading se kam hai. Agar meter badla hai to “Correction” use karein."],
  INVALID_READING: ["Please enter a valid meter reading.", "Sahi meter reading daalein."],
  REASON_REQUIRED: ["Please write a short reason.", "Chhota sa reason likhein."],
  READING_DATE_ORDER: ["The date must be after the room's last reading. To change the last reading, use “Fix”.", "Date pichhli reading ke baad ki honi chahiye. Pichhli reading badalne ke liye “Fix” use karein."],
  NOT_LATEST_READING: ["Only the latest reading of a room can be changed or deleted.", "Room ki sirf sabse nayi reading badli ya delete ki ja sakti hai."],
  RATE_NOT_SET: ["Set the rate per unit first (top of this page).", "Pehle per unit rate set karein (page ke upar)."],
  METER_MODE: ["This building charges electricity by room meter: charges are added automatically when you save a reading.", "Is building mein bijli room meter se lagti hai: reading save karte hi charge apne aap jud jata hai."],
  METER_CHARGES_EXIST: ["Meter readings have already been charged for this month, so the main bill cannot be split again.", "Is mahine meter readings ka charge pehle hi jud chuka hai, isliye main bill dobara nahi baant sakte."],
  ONBOARDING_LOCKED: ["Your application is already submitted and is being reviewed.", "Aapki application submit ho chuki hai aur review mein hai."],
  NO_PENDING_SUBSCRIPTION: ["Please complete your PG details first.", "Pehle apni PG ki details poori karein."],
  RATE_LIMITED: ["Too many attempts. Please try again after some time.", "Bahut zyada koshish ho gayi. Thodi der baad try karein."],
  PAYMENT_NOT_VERIFIED: ["Verify the payment first, then approve.", "Pehle payment verify karein, phir approve karein."],
  ALREADY_REVIEWED: ["This payment has already been reviewed.", "Yeh payment pehle hi review ho chuka hai."],
  INVALID_TRANSITION: ["This action is not possible in the current status.", "Is status mein yeh action nahi ho sakta."],
  ALREADY_VACATED: ["This tenant has already vacated.", "Yeh tenant pehle hi ja chuka hai."],
  BUILDING_NOT_ACTIVE: ["This building is not active yet.", "Yeh building abhi active nahi hai."],
  DIFFERENT_BUILDING: ["Tenant and bed must be in the same building.", "Tenant aur bed ek hi building mein hone chahiye."],
  FORBIDDEN: ["You are not allowed to do this.", "Aapko iski permission nahi hai."],
  NOT_FOUND: ["Record not found.", "Record nahi mila."],
};

export function friendlyError(error: unknown, t: T): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return t(...MESSAGES[code]);
  }
  if (/row-level security|permission denied|42501/i.test(raw)) return t(...MESSAGES.FORBIDDEN);
  if (/fetch failed|network|ECONN|timeout/i.test(raw)) {
    return t("Could not reach the server. Check your internet and try again.", "Server se connect nahi ho paya. Internet check karke dobara try karein.");
  }
  return t("Something went wrong. Please try again.", "Kuch gadbad ho gayi. Dobara try karein.");
}
