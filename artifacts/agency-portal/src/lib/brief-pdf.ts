import jsPDF from "jspdf";

/* ────────────────────────────────────────────────────────────────────────
   Generatore PDF del Brief cliente — stile Be Kind Social Agency.
   Copertina con logo cliente + brand, sezioni eleganti, footer agenzia.
   ──────────────────────────────────────────────────────────────────────── */

const SAGE = { r: 122, g: 143, b: 92 };
const SAGE_DARK = { r: 47, g: 60, b: 33 };
const SAGE_SOFT = { r: 238, g: 242, b: 230 };
const INK = { r: 33, g: 37, b: 31 };
const GRAY = { r: 122, g: 128, b: 116 };
const HAIR = { r: 224, g: 228, b: 218 };
const WHITE = { r: 255, g: 255, b: 255 };

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
  brandColor?: string | null; // accento del cliente (es. "#7a8f5c")
  sections: BriefPdfSection[];
  agencyLogoUrl?: string; // default "/logo-bekind.png"
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

  const setFill = (c: Rgb) => doc.setFillColor(c.r, c.g, c.b);
  const setText = (c: Rgb) => doc.setTextColor(c.r, c.g, c.b);
  const setDraw = (c: Rgb) => doc.setDrawColor(c.r, c.g, c.b);

  const dateStr = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  /* ── COPERTINA ────────────────────────────────────────────── */
  setFill(SAGE_DARK);
  doc.rect(0, 0, W, H, "F");
  // banda accento cliente
  setFill(accent);
  doc.rect(0, 0, W, 6, "F");

  // card bianca centrale col logo cliente
  const cardW = 96;
  const cardH = 96;
  const cardX = (W - cardW) / 2;
  const cardY = 56;
  setFill(WHITE);
  doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "F");
  if (clientLogo) {
    const maxW = cardW - 26;
    const maxH = cardH - 26;
    let w = maxW;
    let h = w / clientLogo.ratio;
    if (h > maxH) {
      h = maxH;
      w = h * clientLogo.ratio;
    }
    doc.addImage(clientLogo.dataUrl, clientLogo.format, cardX + (cardW - w) / 2, cardY + (cardH - h) / 2, w, h, undefined, "FAST");
  } else {
    setText(SAGE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    const initials = input.clientName.trim().slice(0, 2).toUpperCase() || "CL";
    doc.text(initials, W / 2, cardY + cardH / 2 + 6, { align: "center" });
  }

  // titolo
  setText(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(input.clientName, W / 2, cardY + cardH + 26, { align: "center", maxWidth: W - M * 2 });

  setText({ r: 197, g: 212, b: 168 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("BRIEF CLIENTE", W / 2, cardY + cardH + 36, { align: "center" });

  setText({ r: 160, g: 175, b: 140 });
  doc.setFontSize(10);
  doc.text(dateStr, W / 2, cardY + cardH + 44, { align: "center" });

  // footer copertina
  if (agencyLogo) {
    const lw = 34;
    const lh = lw / agencyLogo.ratio;
    doc.addImage(agencyLogo.dataUrl, agencyLogo.format, (W - lw) / 2, H - 30, lw, Math.min(lh, 18), undefined, "FAST");
  } else {
    setText({ r: 197, g: 212, b: 168 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("BE KIND SOCIAL AGENCY", W / 2, H - 22, { align: "center" });
  }

  /* ── CONTENUTO ────────────────────────────────────────────── */
  let page = 1;
  const contentTop = 30;
  const contentBottom = H - 20;
  let y = contentTop;

  const drawPageChrome = () => {
    // header sottile
    setFill(SAGE);
    doc.rect(0, 0, W, 3, "F");
    setText(GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Brief · ${input.clientName}`, M, 12);
    doc.text(dateStr, W - M, 12, { align: "right" });
    setDraw(HAIR);
    doc.setLineWidth(0.2);
    doc.line(M, 15, W - M, 15);
    // footer
    setText(GRAY);
    doc.setFontSize(8);
    doc.text("Be Kind Social Agency", M, H - 10);
    doc.text(`Pag. ${page}`, W - M, H - 10, { align: "right" });
  };

  const newPage = () => {
    doc.addPage();
    page += 1;
    drawPageChrome();
    y = contentTop;
  };

  const ensure = (needed: number) => {
    if (y + needed > contentBottom) newPage();
  };

  // Prima pagina di contenuto (la copertina non è numerata).
  doc.addPage();
  page = 1;
  drawPageChrome();
  y = contentTop;

  const sections = input.sections.filter((s) => s.fields.some((f) => f.value.trim().length > 0));

  if (sections.length === 0) {
    setText(GRAY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.text("Nessuna informazione inserita nel brief.", M, y + 10);
  }

  for (const section of sections) {
    const fields = section.fields.filter((f) => f.value.trim().length > 0);
    if (fields.length === 0) continue;

    ensure(18);
    // intestazione sezione
    setFill(SAGE_SOFT);
    doc.roundedRect(M, y, W - M * 2, 11, 2.5, 2.5, "F");
    setFill(accent);
    doc.roundedRect(M, y, 3, 11, 1.5, 1.5, "F");
    setText(SAGE_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(section.label.toUpperCase(), M + 8, y + 7.4);
    y += 16;

    for (const f of fields) {
      const label = f.label;
      const value = f.value.trim();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      const labelLines = doc.splitTextToSize(label, W - M * 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const valueLines = doc.splitTextToSize(value, W - M * 2 - 4);
      const blockH = labelLines.length * 4.6 + valueLines.length * 4.8 + 6;

      ensure(blockH);

      setText(SAGE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(labelLines, M, y);
      y += labelLines.length * 4.6 + 1.5;

      setText(INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(valueLines, M + 4, y);
      y += valueLines.length * 4.8 + 4.5;

      setDraw(HAIR);
      doc.setLineWidth(0.15);
      doc.line(M, y - 1.5, W - M, y - 1.5);
    }
    y += 4;
  }

  const safeName = input.clientName.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "Cliente";
  doc.save(`Brief_${safeName}.pdf`);
}
