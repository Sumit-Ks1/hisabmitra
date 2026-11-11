import { ImageResponse } from "next/og";
import { LOGO_GEOMETRY } from "@/components/branding/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: full-bleed tile (iOS applies its own corner mask). */
export default function AppleIcon() {
  const g = LOGO_GEOMETRY;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: g.colors.tile }}>
        <svg width="180" height="180" viewBox="2 2 36 36">
          <path d={g.house} fill={g.colors.house} />
          <path d={g.check} fill="none" stroke={g.colors.check} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={g.dot.cx} cy={g.dot.cy} r={g.dot.r} fill={g.colors.dot} />
        </svg>
      </div>
    ),
    size,
  );
}
