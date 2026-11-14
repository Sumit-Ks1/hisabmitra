// Generates the PWA icons in public/icons from the logo geometry.
// Run: node scripts/generate-icons.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const house = "M10.5 19.2 19.1 11.9a1.4 1.4 0 0 1 1.8 0l8.6 7.3a1.4 1.4 0 0 1 .5 1.1v8.3a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-8.3a1.4 1.4 0 0 1 .5-1.1Z";
const mark = `<path d="${house}" fill="#FFFFFF"/><path d="M15.6 22.6 18.7 25.6 24.5 19.6" fill="none" stroke="#3A52D6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="31" cy="10" r="2.6" fill="#F5C451"/>`;

// "any": rounded tile. "maskable": full-bleed with the mark inside the 80% safe zone.
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#4F6EF7"/>${mark}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#4F6EF7"/><g transform="translate(20 20) scale(0.72) translate(-20 -20)">${mark}</g></svg>`;

mkdirSync("public/icons", { recursive: true });
for (const [name, svg, size] of [
  ["icon-192.png", any, 192],
  ["icon-512.png", any, 512],
  ["maskable-192.png", maskable, 192],
  ["maskable-512.png", maskable, 512],
]) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("wrote", name);
}
