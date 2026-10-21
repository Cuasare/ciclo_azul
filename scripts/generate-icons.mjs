// Gera os ícones PNG e SVG do PWA, planos (fundo azul + gota branca), sem dependências:
//   node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');
mkdirSync(OUT, { recursive: true });

const BLUE = [21, 86, 168], WHITE = [255, 255, 255];

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(size, rgb) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** `scale` encolhe a gota (o ícone maskable precisa de margem de segurança) */
function render(size, scale = 1) {
  const buf = Buffer.alloc(size * size * 3);
  const S = 4; // supersampling para suavizar a borda
  const cx = 0.5, cy = 0.5 + 0.085 * scale, r = 0.235 * scale;
  const apex = [cx, 0.5 - 0.33 * scale];
  const cosB = r / (cy - apex[1]), sinB = Math.sqrt(1 - cosB * cosB);
  const tL = [cx - r * sinB, cy - r * cosB], tR = [cx + r * sinB, cy - r * cosB];
  const side = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const inTri = (p) => { const d1 = side(p, apex, tL), d2 = side(p, tL, tR), d3 = side(p, tR, apex); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
  const inDrop = (x, y) => Math.hypot(x - cx, y - cy) <= r || (y < cy && inTri([x, y]));

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let white = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) if (inDrop((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size)) white++;
      const t = white / (S * S), i = (py * size + px) * 3;
      for (let k = 0; k < 3; k++) buf[i + k] = Math.round(BLUE[k] + (WHITE[k] - BLUE[k]) * t);
    }
  }
  return png(size, buf);
}

writeFileSync(join(OUT, 'icon-192.png'), render(192));
writeFileSync(join(OUT, 'icon-512.png'), render(512));
writeFileSync(join(OUT, 'icon-maskable-512.png'), render(512, 0.78));
writeFileSync(join(OUT, 'apple-touch-icon.png'), render(180));
writeFileSync(join(OUT, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1556a8"/>
  <path d="M256 86s121 128 121 224a121 121 0 0 1-242 0c0-96 121-224 121-224Z" fill="#fff"/>
</svg>
`);
console.log('Ícones gerados em', OUT);
