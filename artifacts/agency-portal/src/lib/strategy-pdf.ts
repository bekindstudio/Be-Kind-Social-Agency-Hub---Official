import jsPDF from "jspdf";

const SAGE = { r: 122, g: 143, b: 92 };
const SAGE_LIGHT = { r: 232, g: 238, b: 222 };
const SAGE_DARK = { r: 42, g: 56, b: 28 };
const WHITE = { r: 255, g: 255, b: 255 };
const DARK = { r: 30, g: 30, b: 30 };
const GRAY = { r: 120, g: 120, b: 120 };
const W = 297;
const H = 210;
const MARGIN = 20;
const CONTENT_W = W - MARGIN * 2;

interface StrategySection {
  title: string;
  subtitle?: string;
  items: { label?: string; text: string }[];
}

function parseHtmlToSections(html: string): StrategySection[] {
  const sections: StrategySection[] = [];
  const div = document.createElement("div");
  div.innerHTML = html;

  let current: StrategySection | null = null;

  for (const node of Array.from(div.children)) {
    const tag = node.tagName.toLowerCase();
    const text = (node.textContent || "").trim();
    if (!text) continue;

    if (tag === "h2") {
      if (current) sections.push(current);
      current = { title: text, items: [] };
    } else if (tag === "h3" && current) {
      current.subtitle = text;
      current.items.push({ label: text, text: "" });
    } else if (current) {
      if (tag === "ul" || tag === "ol") {
        const listItems = Array.from(node.querySelectorAll("li"))
          .map(li => (li.textContent || "").trim())
          .filter(Boolean);
        current.items.push({ text: listItems.map(i => `  ${i}`).join("\n") });
      } else if (tag === "blockquote") {
        current.items.push({ label: "Nota", text });
      } else {
        current.items.push({ text });
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

function addLogoFooter(doc: jsPDF, pageNum: number) {
  doc.setFontSize(7);
  doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  doc.text("Be Kind Social Agency", MARGIN, H - 8);

  doc.setFontSize(7);
  doc.text(`${pageNum}`, W - MARGIN, H - 8, { align: "right" });

  doc.setDrawColor(SAGE.r, SAGE.g, SAGE.b);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, H - 12, W - MARGIN, H - 12);
}

function addDecoBar(doc: jsPDF) {
  doc.setFillColor(SAGE.r, SAGE.g, SAGE.b);
  doc.rect(0, 0, 6, H, "F");
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(""); continue; }
    const wrapped = doc.splitTextToSize(para, maxWidth);
    lines.push(...wrapped);
  }
  return lines;
}

export function generateStrategyPDF(clientName: string, strategyHtml: string, logoDataUrl?: string): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let pageNum = 1;

  doc.setFillColor(SAGE_DARK.r, SAGE_DARK.g, SAGE_DARK.b);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(SAGE.r, SAGE.g, SAGE.b);
  doc.roundedRect(W / 2 - 90, 30, 180, 2, 1, 1, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(SAGE_LIGHT.r, SAGE_LIGHT.g, SAGE_LIGHT.b);
  doc.text("CONTENT STRATEGY", W / 2, 50, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  const nameLines = doc.splitTextToSize(clientName.toUpperCase(), 220);
  let nameY = 70;
  for (const line of nameLines) {
    doc.text(line, W / 2, nameY, { align: "center" });
    nameY += 14;
  }

  doc.setFillColor(SAGE.r, SAGE.g, SAGE.b);
  doc.roundedRect(W / 2 - 90, nameY + 5, 180, 2, 1, 1, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(SAGE_LIGHT.r, SAGE_LIGHT.g, SAGE_LIGHT.b);
  doc.text("Be Kind Social Agency", W / 2, nameY + 20, { align: "center" });

  const year = new Date().getFullYear();
  doc.setFontSize(9);
  doc.text(`Strategia ${year}`, W / 2, nameY + 28, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(SAGE.r, SAGE.g, SAGE.b);
  doc.text(`Tutti i diritti riservati - Be Kind Social Agency ${year}`, W / 2, H - 10, { align: "center" });

  const sections = parseHtmlToSections(strategyHtml);

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    pageNum++;

    doc.addPage();
    doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
    doc.rect(0, 0, W, H, "F");
    addDecoBar(doc);

    doc.setFillColor(SAGE_DARK.r, SAGE_DARK.g, SAGE_DARK.b);
    doc.roundedRect(MARGIN + 10, 18, CONTENT_W - 10, 40, 3, 3, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(SAGE.r, SAGE.g, SAGE.b);
    const secNum = section.title.match(/^(\d+)\./)?.[1] || `${si + 1}`;
    doc.text(`SEZIONE ${secNum}`, MARGIN + 20, 30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    const titleClean = section.title.replace(/^\d+\.\s*/, "");
    const titleLines = doc.splitTextToSize(titleClean.toUpperCase(), CONTENT_W - 30);
    let tY = 42;
    for (const tl of titleLines) {
      doc.text(tl, MARGIN + 20, tY);
      tY += 8;
    }

    addLogoFooter(doc, pageNum);

    let y = 70;
    const contentItems = section.items.filter(i => i.text.trim());

    for (const item of contentItems) {
      if (y > H - 25) {
        pageNum++;
        doc.addPage();
        doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
        doc.rect(0, 0, W, H, "F");
        addDecoBar(doc);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(SAGE.r, SAGE.g, SAGE.b);
        doc.text(`${titleClean.toUpperCase()} (continua)`, MARGIN + 14, 18);

        addLogoFooter(doc, pageNum);
        y = 28;
      }

      if (item.label) {
        doc.setFillColor(SAGE.r, SAGE.g, SAGE.b);
        doc.roundedRect(MARGIN + 10, y - 4, 4, 4, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(SAGE_DARK.r, SAGE_DARK.g, SAGE_DARK.b);
        doc.text(item.label, MARGIN + 18, y);
        y += 7;
      }

      if (item.text) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(DARK.r, DARK.g, DARK.b);

        const lines = wrapText(doc, item.text, CONTENT_W - 20);
        for (const line of lines) {
          if (y > H - 25) {
            pageNum++;
            doc.addPage();
            doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
            doc.rect(0, 0, W, H, "F");
            addDecoBar(doc);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(SAGE.r, SAGE.g, SAGE.b);
            doc.text(`${titleClean.toUpperCase()} (continua)`, MARGIN + 14, 18);

            addLogoFooter(doc, pageNum);
            y = 28;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(DARK.r, DARK.g, DARK.b);
          }

          const isBullet = line.trimStart().startsWith("\u2022") || line.trimStart().startsWith("-") || line.trimStart().startsWith("\u2013");
          if (isBullet) {
            doc.setFillColor(SAGE.r, SAGE.g, SAGE.b);
            doc.circle(MARGIN + 14, y - 1.2, 1, "F");
            doc.text(line.replace(/^[\s\-\u2022\u2013]+/, ""), MARGIN + 18, y);
          } else {
            doc.text(line, MARGIN + 14, y);
          }
          y += 4.5;
        }
        y += 3;
      }
    }
  }

  pageNum++;
  doc.addPage();
  doc.setFillColor(SAGE_DARK.r, SAGE_DARK.g, SAGE_DARK.b);
  doc.rect(0, 0, W, H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text("GRAZIE", W / 2, 70, { align: "center" });

  doc.setFillColor(SAGE.r, SAGE.g, SAGE.b);
  doc.roundedRect(W / 2 - 40, 78, 80, 2, 1, 1, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(SAGE_LIGHT.r, SAGE_LIGHT.g, SAGE_LIGHT.b);
  doc.text(`Strategia realizzata per ${clientName}`, W / 2, 92, { align: "center" });

  doc.setFontSize(10);
  doc.text("Be Kind Social Agency", W / 2, 105, { align: "center" });
  doc.text("bekindsocialagency@gmail.com", W / 2, 113, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(SAGE.r, SAGE.g, SAGE.b);
  doc.text(`Tutti i diritti riservati - Be Kind Social Agency ${year}`, W / 2, H - 10, { align: "center" });

  return doc;
}
