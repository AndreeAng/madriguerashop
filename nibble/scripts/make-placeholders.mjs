// Genera los placeholders locales de banner/producto (public/placeholders/).
// Se commitean los .webp resultantes; este script existe para regenerarlos
// si cambia la paleta. Correr: node scripts/make-placeholders.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/placeholders", { recursive: true });

const banner = `<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1410"/>
      <stop offset="0.6" stop-color="#3d2f1f"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
</svg>`;

const product = `<svg width="900" height="900" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="900" fill="#f7f5f0"/>
  <circle cx="450" cy="420" r="160" fill="#e7e3d8"/>
  <rect x="290" y="620" width="320" height="26" rx="13" fill="#e7e3d8"/>
  <rect x="350" y="670" width="200" height="20" rx="10" fill="#efece3"/>
</svg>`;

await sharp(Buffer.from(banner)).webp({ quality: 80 }).toFile("public/placeholders/banner.webp");
await sharp(Buffer.from(product)).webp({ quality: 85 }).toFile("public/placeholders/product.webp");
console.log("placeholders ok");
