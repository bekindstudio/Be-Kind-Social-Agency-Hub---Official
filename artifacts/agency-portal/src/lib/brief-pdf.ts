import jsPDF from "jspdf";

/* ────────────────────────────────────────────────────────────────────────
   Generatore PDF del Brief cliente — stile Be Kind Social Agency.
   Copertina scenografica, indice con progress, sezioni numerate, chiusura.
   ──────────────────────────────────────────────────────────────────────── */

const SAGE = { r: 122, g: 143, b: 92 };
const SAGE_DARK = { r: 39, g: 50, b: 28 };
const SAGE_DEEP = { r: 28, g: 37, b: 20 };
const SAGE_SOFT = { r: 238, g: 242, b: 230 };
const INK = { r: 34, g: 38, b: 31 };
const GRAY = { r: 122, g: 128, b: 116 };
const HAIR = { r: 226, g: 230, b: 220 };
const WHITE = { r: 255, g: 255, b: 255 };
const CREAM = { r: 247, g: 248, b: 243 };

export interface BriefPdfField {
  label: string;
  value: string;
}
export interface BriefPdfSection {
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

type Rgb = { r: number; g: number; b: number };
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
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210;
  const H = 297;
  const M = 18;
  const accent = hexToRgb(input.brandColor) ?? SAGE;

  const [clientLogo, agencyLogo] = await Promise.all([
    loadImage(input.clientLogoUrl),
    loadImage(input.agencyLogoUrl ?? "/logo-bekind.png"),
  ]);

  const fill = (c: Rgb) => doc.setFillColor(c.r, c.g, c.b);
  const text = (c: Rgb) => doc.setTextColor(c.r, c.g, c.b);
  const draw = (c: Rgb) => doc.setDrawColor(c.r, c.g, c.b);

  const dateStr = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  const drawLogo = (img: LoadedImg, x: number, y: number, maxW: number, maxH: number) => {
    let w = maxW;
    let h = w / img.ratio;
    if (h > maxH) {
      h = maxH;
      w = h * img.ratio;
    }
    doc.addImage(img.dataUrl, img.format, x + (maxW - w) / 2, y + (maxH - h) / 2, w, h, undefined, "FAST");
  };

  // stats
  const allSections = input.sections;
  const totalFields = allSections.reduce((a, s) => a + s.fields.length, 0);
  const filledFields = allSections.reduce((a, s) => a + s.fields.filter((f) => f.value.trim()).length, 0);
  const pct = totalFields ? Math.round((filledFields / totalFields) * 100) : 0;

  /* ════════ COPERTINA ════════ */
  fill(SAGE_DEEP);
  doc.rect(0, 0, W, H, "F");
  // forme decorative morbide
  fill(mix(SAGE_DEEP, SAGE, 0.18));
  doc.circle(W - 6, 40, 60, "F");
  fill(mix(SAGE_DEEP, SAGE, 0.12));
  doc.circle(12, H - 24, 52, "F");
  // banda accento brand cliente
  fill(accent);
  doc.rect(0, 0, W, 5, "F");

  // etichetta agenzia in alto
  text(mix(SAGE, WHITE, 0.55));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("BE KIND SOCIAL AGENCY", M, 22, { charSpace: 1.2 });

  // card logo cliente con "ombra"
  const cardW = 92;
  const cardH = 92;
  const cardX = (W - cardW) / 2;
  const cardY = 64;
  fill(mix(SAGE_DEEP, { r: 0, g: 0, b: 0 }, 0.35));
  doc.roundedRect(cardX + 2.5, cardY + 3.5, cardW, cardH, 8, 8, "F"); // ombra
  fill(WHITE);
  doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, "F");
  if (clientLogo) {
    drawLogo(clientLogo, cardX + 12, cardY + 12, cardW - 24, cardH - 24);
  } else {
    text(SAGE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(38);
    doc.text((input.clientName.trim().slice(0, 2) || "CL").toUpperCase(), W / 2, cardY + cardH / 2 + 6, { align: "center" });
  }

  // nome cliente
  text(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text(input.clientName, W / 2, cardY + cardH + 28, { align: "center", maxWidth: W - M * 2 });

  // sottotitolo
  text(mix(SAGE, WHITE, 0.5));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("BRIEF STRATEGICO", W / 2, cardY + cardH + 38, { align: "center", charSpace: 3 });

  // linea accento
  draw(accent);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 16, cardY + cardH + 44, W / 2 + 16, cardY + cardH + 44);

  text(mix(SAGE, WHITE, 0.3));
  doc.setFontSize(10);
  doc.text(dateStr, W / 2, cardY + cardH + 52, { align: "center" });

  // footer copertina
  if (agencyLogo) {
    drawLogo(agencyLogo, (W - 40) / 2, H - 34, 40, 18);
  }
  text(mix(SAGE, WHITE, 0.4));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Documento strategico riservato", W / 2, H - 12, { align: "center", charSpace: 0.5 });

  /* ════════ PAGINE CONTENUTO (header/footer comuni) ════════ */
  let page = 0;
  const top = 32;
  const bottom = H - 18;
  let y = top;

  const chrome = () => {
    fill(accent);
    doc.rect(0, 0, W, 2.5, "F");
    text(GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(input.clientName.toUpperCase(), M, 13, { charSpace: 0.5 });
    doc.text("BRIEF · BE KIND SOCIAL AGENCY", W - M, 13, { align: "right", charSpace: 0.5 });
    draw(HAIR);
    doc.setLineWidth(0.2);
    doc.line(M, 16, W - M, 16);
    text(GRAY);
    doc.setFontSize(7.5);
    doc.text(dateStr, M, H - 9);
    doc.text(String(page), W - M, H - 9, { align: "right" });
  };
  const addPage = () => {
    doc.addPage();
    page += 1;
    chrome();
    y = top;
  };
  const ensure = (need: number) => {
    if (y + need > bottom) addPage();
  };

  /* ──── INDICE ──── */
  addPage();
  text(SAGE_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Indice", M, y + 4);
  y += 14;

  // progress generale
  fill(CREAM);
  doc.roundedRect(M, y, W - M * 2, 20, 3, 3, "F");
  text(GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("COMPLETAMENTO BRIEF", M + 6, y + 7, { charSpace: 0.8 });
  text(SAGE_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${pct}%  ·  ${filledFields}/${totalFields} campi`, W - M - 6, y + 7.5, { align: "right" });
  const barX = M + 6;
  const barW = W - M * 2 - 12;
  fill(HAIR);
  doc.roundedRect(barX, y + 12, barW, 3.5, 1.75, 1.75, "F");
  fill(accent);
  doc.roundedRect(barX, y + 12, Math.max(2, (barW * pct) / 100), 3.5, 1.75, 1.75, "F");
  y += 28;

  allSections.forEach((s, i) => {
    const filled = s.fields.filter((f) => f.value.trim()).length;
    ensure(11);
    // numero
    fill(filled > 0 ? SAGE : HAIR);
    doc.circle(M + 3.5, y + 1, 3.4, "F");
    text(filled > 0 ? WHITE : GRAY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(String(i + 1), M + 3.5, y + 2.4, { align: "center" });
    // nome
    text(filled > 0 ? INK : GRAY);
    doc.setFont("helvetica", filled > 0 ? "bold" : "normal");
    doc.setFontSize(10.5);
    doc.text(s.label, M + 11, y + 2.4);
    // conteggio
    text(GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`${filled}/${s.fields.length}`, W - M, y + 2.4, { align: "right" });
    y += 9;
  });

  /* ──── SEZIONI ──── */
  const sections = allSections
    .map((s, idx) => ({ ...s, idx, fields: s.fields.filter((f) => f.value.trim()) }))
    .filter((s) => s.fields.length > 0);

  if (sections.length === 0) {
    addPage();
    text(GRAY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.text("Nessuna informazione inserita nel brief.", M, y + 8);
  }

  for (const section of sections) {
    addPage(); // ogni sezione inizia su nuova pagina per ordine/eleganza

    // header sezione: numero in cerchio + titolo
    fill(SAGE);
    doc.circle(M + 5, y + 4, 5, "F");
    text(WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(String(section.idx + 1), M + 5, y + 5.6, { align: "center" });
    text(SAGE_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(section.label, M + 14, y + 6.5, { maxWidth: W - M * 2 - 14 });
    y += 13;
    draw(accent);
    doc.setLineWidth(0.6);
    doc.line(M, y, W - M, y);
    y += 7;

    for (const f of section.fields) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const labelLines = doc.splitTextToSize(f.label.toUpperCase(), W - M * 2 - 10) as string[];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      const valueLines = doc.splitTextToSize(f.value.trim(), W - M * 2 - 10) as string[];
      const blockH = labelLines.length * 4.4 + valueLines.length * 5.0 + 9;

      ensure(blockH + 2);

      // card campo
      fill(CREAM);
      doc.roundedRect(M, y, W - M * 2, blockH, 2.5, 2.5, "F");
      fill(accent);
      doc.roundedRect(M, y, 2.5, blockH, 1.25, 1.25, "F"); // tick accento

      let ty = y + 6.5;
      text(SAGE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(labelLines, M + 7, ty, { charSpace: 0.4 });
      ty += labelLines.length * 4.4 + 1.5;

      text(INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(valueLines, M + 7, ty);

      y += blockH + 4;
    }
  }

  /* ════════ CHIUSURA ════════ */
  doc.addPage();
  page += 1;
  fill(SAGE_DEEP);
  doc.rect(0, 0, W, H, "F");
  fill(mix(SAGE_DEEP, SAGE, 0.16));
  doc.circle(W / 2, H + 30, 90, "F");
  fill(accent);
  doc.rect(0, 0, W, 5, "F");
  text(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text("Grazie.", W / 2, H / 2 - 6, { align: "center" });
  text(mix(SAGE, WHITE, 0.5));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Trasformiamo questo brief in strategia.", W / 2, H / 2 + 4, { align: "center" });
  if (agencyLogo) {
    drawLogo(agencyLogo, (W - 44) / 2, H - 46, 44, 20);
  }
  text(mix(SAGE, WHITE, 0.45));
  doc.setFontSize(8.5);
  doc.text("BE KIND SOCIAL AGENCY", W / 2, H - 20, { align: "center", charSpace: 1.5 });

  const safe = input.clientName.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "Cliente";
  doc.save(`Brief_${safe}.pdf`);
}
