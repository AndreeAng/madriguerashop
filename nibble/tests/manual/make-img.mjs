// Genera una imagen PNG de prueba para uploads (QR, banner, comprobante).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("tests/manual/assets", { recursive: true });

const svg = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#f59e0b"/>
  <rect x="40" y="40" width="320" height="320" fill="white"/>
  <text x="200" y="215" font-size="42" text-anchor="middle" font-family="monospace">TEST IMG</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("tests/manual/assets/test-img.png");
console.log("img ok");
