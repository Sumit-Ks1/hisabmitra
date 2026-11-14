import { ImageResponse } from "next/og";
import { LOGO_GEOMETRY } from "@/components/branding/logo";

export const alt = "HisabMitra — PG ka hisaab, ab digital. Smart PG & hostel management software.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mark({ px }: { px: number }) {
  const g = LOGO_GEOMETRY;
  return (
    <svg width={px} height={px} viewBox={g.viewBox}>
      <rect width="40" height="40" rx={g.tile.rx} fill={g.colors.tile} />
      <path d={g.house} fill={g.colors.house} />
      <path d={g.check} fill="none" stroke={g.colors.check} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={g.dot.cx} cy={g.dot.cy} r={g.dot.r} fill={g.colors.dot} />
    </svg>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#111827",
          backgroundImage:
            "radial-gradient(circle at 85% 20%, rgba(79,110,247,0.45), transparent 45%), radial-gradient(circle at 10% 110%, rgba(245,196,81,0.18), transparent 40%)",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Mark px={72} />
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
              <span>Hisab</span>
              <span style={{ color: "#7C8FFF" }}>Mitra</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 22,
              letterSpacing: 3,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#F5C451" }} />
            FOR PG OWNERS IN INDIA
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>
            PG ka hisaab, ab digital.
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#CBD5E1", lineHeight: 1.35, maxWidth: 900 }}>
            Tenants, rooms, monthly rent, electricity bills and payments — one smart dashboard for
            Indian PG owners.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#94A3B8" }}>
          {["Tenants", "Rooms & beds", "Rent", "Electricity", "Reports"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "8px 18px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
