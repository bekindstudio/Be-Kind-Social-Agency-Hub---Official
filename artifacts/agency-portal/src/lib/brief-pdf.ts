import jsPDF from "jspdf";

/* ────────────────────────────────────────────────────────────────────────
   Brief cliente — PDF ORIZZONTALE, grafico, stile Be Kind (verde chiaro).
   Copertina con logo agenzia grande, pagina Brand Kit (logo + palette +
   typography), infografica Target/Persona, sezioni a card.
   ──────────────────────────────────────────────────────────────────────── */

type Rgb = { r: number; g: number; b: number };

// Palette più chiara (in linea col logo Be Kind)
const SAGE = { r: 150, g: 176, b: 118 }; // verde salvia chiaro (accento)
const SAGE_DK = { r: 96, g: 116, b: 70 }; // per testi/titoli su chiaro
const SAGE_LT = { r: 226, g: 235, b: 211 }; // sfondo soft
const SAGE_LT2 = { r: 240, g: 244, b: 231 };
const CREAM = { r: 246, g: 248, b: 241 };
const INK = { r: 49, g: 55, b: 43 };
const GRAY = { r: 124, g: 131, b: 114 };
const HAIR = { r: 223, g: 229, b: 215 };
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

export interface BriefPdfField {
  key: string;
  label: string;
  value: string;
}
export interface BriefPdfSection {
  key: string;
  label: string;
  fields: BriefPdfField[];
}
export interface BriefPdfInput {
  clientName: string;
  clientLogoUrl?: string | null;
  brandColor?: string | null;
  sections: BriefPdfSection[];
  agencyLogoUrl?: string;
}

type LoadedImg = { dataUrl: string; ratio: number; format: "PNG" | "JPEG" };

function hexToRgb(hex?: string | null): Rgb | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
}
function toHex(c: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
}
function lum(c: Rgb): number {
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

async function loadImage(url?: string | null): Promise<LoadedImg | null> {
  if (!url) return null;
  try {
    let dataUrl = url;
    if (!url.startsWith("data:")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }
    const ratio = await new Promise<number>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img.width && img.height ? img.width / img.height : 1);
      img.onerror = reject;
      img.src = dataUrl;
    });
    const format: "PNG" | "JPEG" = /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
    return { dataUrl, ratio, format };
  } catch {
    return null;
  }
}

export async function generateBriefPDF(input: BriefPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297;
  const H = 210;
  const M = 16;
  const accent = hexToRgb(input.brandColor) ?? SAGE;

  const [clientLogo, agencyLogo] = await Promise.all([
    loadImage(input.clientLogoUrl),
    loadImage(input.agencyLogoUrl ?? "/logo-bekind.png"),
  ]);

  const fill = (c: Rgb) => doc.setFillColor(c.r, c.g, c.b);
  const text = (c: Rgb) => doc.setTextColor(c.r, c.g, c.b);
  const draw = (c: Rgb) => doc.setDrawColor(c.r, c.g, c.b);
  const font = (style: "normal" | "bold" | "italic", size: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const dateStr = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  const placeImg = (img: LoadedImg, x: number, y: number, maxW: number, maxH: number) => {
    let w = maxW;
    let h = w / img.ratio;
    if (h > maxH) {
      h = maxH;
      w = h * img.ratio;
    }
    doc.addImage(img.dataUrl, img.format, x + (maxW - w) / 2, y + (maxH - h) / 2, w, h, undefined, "FAST");
  };

  // mappa sezione->campo->valore + label
  const valueOf = (sk: string, fk: string): string => {
    const s = input.sections.find((x) => x.key === sk);
    return (s?.fields.find((f) => f.key === fk)?.value ?? "").trim();
  };

  /* ════════ COPERTINA ════════ */
  fill(CREAM);
  doc.rect(0, 0, W, H, "F");
  fill(accent);
  doc.rect(0, 0, W, 4, "F");
  fill(SAGE_LT);
  doc.circle(W - 4, H - 4, 46, "F");
  fill(SAGE_LT2);
  doc.circle(6, 18, 30, "F");

  // Logo agenzia GRANDE in alto
  if (agencyLogo) {
    placeImg(agencyLogo, (W - 120) / 2, 22, 120, 40);
  } else {
    text(SAGE_DK);
    font("bold", 26);
    doc.text("BE KIND SOCIAL AGENCY", W / 2, 44, { align: "center" });
  }

  // divisore brand
  draw(accent);
  doc.setLineWidth(1);
  doc.line(W / 2 - 22, 70, W / 2 + 22, 70);

  // card logo cliente
  const cw = 70;
  const ch = 56;
  const cx = (W - cw) / 2;
  const cy = 80;
  fill(mix(CREAM, BLACK, 0.08));
  doc.roundedRect(cx + 1.5, cy + 2, cw, ch, 6, 6, "F");
  fill(WHITE);
  doc.roundedRect(cx, cy, cw, ch, 6, 6, "F");
  if (clientLogo) placeImg(clientLogo, cx + 8, cy + 8, cw - 16, ch - 16);
  else {
    text(SAGE);
    font("bold", 28);
    doc.text((input.clientName.slice(0, 2) || "CL").toUpperCase(), W / 2, cy + ch / 2 + 5, { align: "center" });
  }

  text(INK);
  font("bold", 26);
  doc.text(input.clientName, W / 2, cy + ch + 18, { align: "center", maxWidth: W - M * 2 });
  text(SAGE_DK);
  font("normal", 12);
  doc.text("BRAND BRIEF", W / 2, cy + ch + 27, { align: "center", charSpace: 4 });
  text(GRAY);
  font("normal", 9);
  doc.text(dateStr, W / 2, cy + ch + 34, { align: "center" });

  /* ════════ header/footer pagine ════════ */
  let page = 0;
  const top = 26;
  const bottom = H - 12;

  const chrome = (title: string) => {
    fill(accent);
    doc.rect(0, 0, W, 2.5, "F");
    text(SAGE_DK);
    font("bold", 12);
    doc.text(title, M, 16);
    text(GRAY);
    font("normal", 8);
    doc.text(input.clientName, W - M, 12, { align: "right" });
    doc.text("Be Kind Social Agency", W - M, 16, { align: "right" });
    draw(HAIR);
    doc.setLineWidth(0.2);
    doc.line(M, 19, W - M, 19);
    text(GRAY);
    font("normal", 7.5);
    doc.text(String(page), W - M, H - 6, { align: "right" });
  };
  const newPage = (title: string) => {
    doc.addPage();
    page += 1;
    chrome(title);
  };

  /* ════════ BRAND KIT ════════ */
  newPage("Brand Kit");
  const colY = top + 4;
  const colGap = 8;
  const colW = (W - M * 2 - colGap * 2) / 3;
  const c1 = M;
  const c2 = M + colW + colGap;
  const c3 = M + (colW + colGap) * 2;

  const colTitle = (x: string | number, label: string) => {
    text(SAGE_DK);
    font("bold", 11);
    doc.text(label, x as number, colY);
  };

  // Col 1 — LOGO
  colTitle(c1, "LOGO");
  fill(WHITE);
  draw(HAIR);
  doc.setLineWidth(0.3);
  doc.roundedRect(c1, colY + 4, colW, 46, 4, 4, "FD");
  if (clientLogo) placeImg(clientLogo, c1 + 8, colY + 10, colW - 16, 34);
  fill(mix(SAGE_DK, BLACK, 0.1));
  doc.roundedRect(c1, colY + 54, colW, 30, 4, 4, "F");
  if (clientLogo) placeImg(clientLogo, c1 + 10, colY + 59, colW - 20, 20);
  text(GRAY);
  font("normal", 7.5);
  doc.text("Su fondo chiaro e su fondo scuro", c1, colY + 90);

  // Col 2 — COLORI (palette derivata dal brand color)
  colTitle(c2, "COLORI");
  const palette: { c: Rgb; name: string }[] = [
    { c: accent, name: "Brand" },
    { c: mix(accent, WHITE, 0.35), name: "Light" },
    { c: mix(accent, WHITE, 0.65), name: "Soft" },
    { c: mix(accent, BLACK, 0.28), name: "Deep" },
    { c: SAGE, name: "Agency sage" },
  ];
  let sy = colY + 6;
  for (const sw of palette) {
    fill(sw.c);
    doc.roundedRect(c2, sy, colW, 13, 2.5, 2.5, "F");
    text(lum(sw.c) > 0.62 ? INK : WHITE);
    font("bold", 8.5);
    doc.text(sw.name, c2 + 4, sy + 6);
    font("normal", 8);
    doc.text(toHex(sw.c), c2 + colW - 4, sy + 6, { align: "right" });
    sy += 16;
  }

  // Col 3 — TYPOGRAPHY
  colTitle(c3, "TYPOGRAPHY");
  fill(SAGE_LT2);
  doc.roundedRect(c3, colY + 4, colW, 80, 4, 4, "F");
  text(SAGE_DK);
  font("bold", 46);
  doc.text("Aa", c3 + 8, colY + 36);
  text(INK);
  font("bold", 11);
  doc.text("Helvetica / Sans", c3 + 8, colY + 48);
  text(GRAY);
  font("normal", 8.5);
  doc.text("Titoli: bold · Corpo: regular", c3 + 8, colY + 55);
  font("bold", 9);
  text(INK);
  doc.text("ABCDEFGHIJKLM", c3 + 8, colY + 64);
  font("normal", 9);
  text(GRAY);
  doc.text("abcdefghijklmnop 0123456789", c3 + 8, colY + 71);

  /* ════════ TARGET / PERSONA (infografica) ════════ */
  const personaHas =
    valueOf("target_personas", "fasce_eta") ||
    valueOf("target_personas", "tipo_persone") ||
    valueOf("target_personas", "locali_o_fuori_zona");
  if (personaHas) {
    newPage("Target · La cliente tipo");
    // avatar
    const ay = top + 8;
    fill(SAGE_LT);
    doc.circle(M + 22, ay + 22, 22, "F");
    text(SAGE_DK);
    font("bold", 22);
    doc.text((input.clientName.slice(0, 1) || "C").toUpperCase(), M + 22, ay + 29, { align: "center" });
    text(INK);
    font("bold", 13);
    doc.text("Cliente tipo", M, ay + 56);
    const tipo = valueOf("target_personas", "tipo_persone");
    if (tipo) {
      text(GRAY);
      font("normal", 9);
      doc.text(doc.splitTextToSize(tipo, 56) as string[], M, ay + 63);
    }

    // tessere statistiche (2 colonne x 3)
    const tiles: { label: string; value: string }[] = [
      { label: "FASCE D'ETÀ", value: valueOf("target_personas", "fasce_eta") },
      { label: "ZONA", value: valueOf("target_personas", "locali_o_fuori_zona") },
      { label: "PROFESSIONE & BUDGET", value: valueOf("target_personas", "professione_disponibilita") },
      { label: "MERCATO", value: valueOf("target_personas", "mercato") },
      { label: "SERVIZIO PIÙ RICHIESTO", value: valueOf("target_personas", "servizio_piu_richiesto") },
      { label: "DA SPINGERE", value: valueOf("target_personas", "servizio_da_spingere") },
    ].filter((t) => t.value);
    const gx = M + 72;
    const gw = (W - gx - M - 8) / 2;
    const gh = 30;
    tiles.forEach((t, i) => {
      const tx = gx + (i % 2) * (gw + 8);
      const ty = top + 6 + Math.floor(i / 2) * (gh + 6);
      fill(SAGE_LT2);
      doc.roundedRect(tx, ty, gw, gh, 3, 3, "F");
      fill(accent);
      doc.roundedRect(tx, ty, 2.5, gh, 1.25, 1.25, "F");
      text(SAGE_DK);
      font("bold", 7.5);
      doc.text(t.label, tx + 6, ty + 7, { charSpace: 0.3 });
      text(INK);
      font("normal", 9);
      doc.text(doc.splitTextToSize(t.value, gw - 12) as string[], tx + 6, ty + 13);
    });

    const cosa = valueOf("comportamento_cliente", "cosa_cercano");
    if (cosa) {
      const by = top + 6 + Math.ceil(tiles.length / 2) * (gh + 6) + 2;
      if (by < bottom - 16) {
        fill(SAGE_DK);
        doc.roundedRect(gx, by, gw * 2 + 8, 18, 3, 3, "F");
        text(WHITE);
        font("bold", 8);
        doc.text("COSA CERCANO", gx + 6, by + 6.5, { charSpace: 0.4 });
        font("normal", 9);
        doc.text(doc.splitTextToSize(cosa, gw * 2 - 4) as string[], gx + 6, by + 12.5);
      }
    }
  }

  /* ════════ SEZIONI (a card, layout masonry 3 col) ════════ */
  // Card generica: ritorna l'altezza
  const measureCard = (w: number, label: string, value: string): number => {
    font("bold", 7.5);
    const ll = (doc.splitTextToSize(label.toUpperCase(), w - 10) as string[]).length;
    font("normal", 9);
    const vl = (doc.splitTextToSize(value, w - 10) as string[]).length;
    return 6 + ll * 3.5 + 1.5 + vl * 4.2 + 5;
  };
  const drawCard = (x: number, y: number, w: number, label: string, value: string, soft = true) => {
    const h = measureCard(w, label, value);
    fill(soft ? SAGE_LT2 : WHITE);
    if (!soft) {
      draw(HAIR);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
    } else {
      doc.roundedRect(x, y, w, h, 2.5, 2.5, "F");
    }
    fill(accent);
    doc.roundedRect(x, y, 2.2, h, 1.1, 1.1, "F");
    text(SAGE_DK);
    font("bold", 7.5);
    const ll = doc.splitTextToSize(label.toUpperCase(), w - 10) as string[];
    doc.text(ll, x + 6, y + 5.5, { charSpace: 0.3 });
    text(INK);
    font("normal", 9);
    doc.text(doc.splitTextToSize(value, w - 10) as string[], x + 6, y + 5.5 + ll.length * 3.5 + 2);
    return h;
  };

  const cols3 = [M, M + colW + colGap, M + (colW + colGap) * 2];

  const SKIP_IN_GENERIC = new Set(["target_personas"]); // già nell'infografica

  for (const section of input.sections) {
    if (SKIP_IN_GENERIC.has(section.key)) continue;
    const fields = section.fields.filter((f) => f.value.trim());
    if (fields.length === 0) continue;

    newPage(section.label);
    let colYs = [top + 4, top + 4, top + 4];

    const placeCard = (label: string, value: string) => {
      const h = measureCard(colW, label, value);
      let idx = colYs.indexOf(Math.min(...colYs));
      if (colYs[idx] + h > bottom) {
        newPage(section.label + " (segue)");
        colYs = [top + 4, top + 4, top + 4];
        idx = 0;
      }
      drawCard(cols3[idx], colYs[idx], colW, label, value);
      colYs[idx] += h + 5;
    };

    for (const f of fields) placeCard(f.label, f.value.trim());
  }

  /* ════════ CHIUSURA ════════ */
  doc.addPage();
  page += 1;
  fill(SAGE_LT);
  doc.rect(0, 0, W, H, "F");
  fill(accent);
  doc.rect(0, 0, W, 4, "F");
  fill(mix(SAGE_LT, WHITE, 0.4));
  doc.circle(W / 2, H + 40, 80, "F");
  if (agencyLogo) placeImg(agencyLogo, (W - 110) / 2, 58, 110, 38);
  text(SAGE_DK);
  font("bold", 24);
  doc.text("Trasformiamo questo brief in strategia.", W / 2, 120, { align: "center", maxWidth: W - 40 });
  text(GRAY);
  font("normal", 10);
  doc.text("Be Kind Social Agency · documento riservato", W / 2, 134, { align: "center", charSpace: 0.5 });

  const safe = input.clientName.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "Cliente";
  doc.save(`Brief_${safe}.pdf`);
}
