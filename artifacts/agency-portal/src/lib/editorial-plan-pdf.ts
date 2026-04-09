import jsPDF from "jspdf";

const SAGE = "#7a8f5c";
const SAGE_DARK = "#2d3a1e";
const SAGE_LIGHT = "#e8ede2";
const DARK = "#1a1a1a";
const GRAY = "#6b7280";
const WHITE = "#ffffff";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const PLATFORMS: Record<string, string> = {
  instagram_feed: "Instagram Feed",
  instagram_stories: "Instagram Stories",
  instagram_reels: "Instagram Reels",
  facebook_feed: "Facebook Feed",
  facebook_stories: "Facebook Stories",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
};

const CONTENT_TYPES: Record<string, string> = {
  post: "Post",
  reel: "Reel",
  story: "Story",
  carousel: "Carosello",
  video: "Video",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

export async function generateEditorialPlanPDF(plan: any, categories: any[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const MARGIN = 20;
  const CONTENT_W = W - 2 * MARGIN;
  let pageNum = 0;

  const clientColor = plan.clientColor || SAGE;

  function addFooter() {
    pageNum++;
    doc.setFontSize(8);
    doc.setTextColor(...hexToRgb(GRAY));
    doc.text("Be Kind Social Agency", MARGIN, H - 10);
    doc.text(`Pagina ${pageNum}`, W - MARGIN, H - 10, { align: "right" });
    doc.setDrawColor(...hexToRgb(SAGE_LIGHT));
    doc.line(MARGIN, H - 14, W - MARGIN, H - 14);
  }

  function newPage() {
    doc.addPage();
    addFooter();
  }

  // COVER PAGE
  doc.setFillColor(...hexToRgb(SAGE_DARK));
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...hexToRgb(SAGE));
  doc.rect(0, 0, W, 6, "F");

  doc.setTextColor(...hexToRgb(WHITE));
  doc.setFontSize(12);
  doc.text("BE KIND SOCIAL AGENCY", W / 2, 50, { align: "center" });

  doc.setFontSize(14);
  doc.setTextColor(...hexToRgb(SAGE_LIGHT));
  doc.text(plan.clientName?.toUpperCase() ?? "CLIENTE", W / 2, 100, { align: "center" });

  doc.setFontSize(32);
  doc.setTextColor(...hexToRgb(WHITE));
  doc.text("PIANO EDITORIALE", W / 2, 125, { align: "center" });

  doc.setFontSize(20);
  doc.setTextColor(...hexToRgb(SAGE));
  doc.text(`${MONTHS[plan.month - 1]} ${plan.year}`, W / 2, 145, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(SAGE_LIGHT));
  doc.text("Preparato da: Be Kind Social Agency", W / 2, 200, { align: "center" });
  doc.text(`Data: ${new Date().toLocaleDateString("it-IT")}`, W / 2, 208, { align: "center" });

  pageNum++;

  // PAGE 2 — OVERVIEW
  newPage();
  let y = 30;

  doc.setFontSize(18);
  doc.setTextColor(...hexToRgb(DARK));
  doc.text("Overview del Piano", MARGIN, y);
  y += 12;

  doc.setFillColor(...hexToRgb(SAGE));
  doc.rect(MARGIN, y, 40, 0.8, "F");
  y += 10;

  const slots = plan.slots ?? [];
  const platformGroups: Record<string, any[]> = {};
  for (const s of slots) {
    (platformGroups[s.platform] = platformGroups[s.platform] || []).push(s);
  }

  doc.setFontSize(11);
  doc.setTextColor(...hexToRgb(DARK));
  doc.text("Riepilogo Contenuti", MARGIN, y);
  y += 8;

  doc.setFillColor(...hexToRgb(SAGE_LIGHT));
  doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(SAGE_DARK));
  doc.text("Piattaforma", MARGIN + 4, y + 7);
  doc.text("Numero Post", MARGIN + 80, y + 7);
  doc.text("Tipo Contenuti", MARGIN + 120, y + 7);
  y += 12;

  doc.setTextColor(...hexToRgb(DARK));
  for (const [platform, pSlots] of Object.entries(platformGroups)) {
    if (y > H - 40) { newPage(); y = 30; }
    doc.setFontSize(9);
    doc.text(PLATFORMS[platform] ?? platform, MARGIN + 4, y + 5);
    doc.text(String(pSlots.length), MARGIN + 80, y + 5);
    const types = [...new Set(pSlots.map((s: any) => CONTENT_TYPES[s.contentType] ?? s.contentType))].join(", ");
    doc.text(types, MARGIN + 120, y + 5);
    doc.setDrawColor(...hexToRgb(SAGE_LIGHT));
    doc.line(MARGIN, y + 8, W - MARGIN, y + 8);
    y += 10;
  }

  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(SAGE_DARK));
  doc.text(`Totale contenuti: ${slots.length}`, MARGIN, y);

  // Category breakdown
  y += 12;
  doc.setFontSize(11);
  doc.setTextColor(...hexToRgb(DARK));
  doc.text("Content Mix", MARGIN, y);
  y += 8;

  const catBreakdown: Record<number, number> = {};
  for (const s of slots) {
    if (s.categoryId) catBreakdown[s.categoryId] = (catBreakdown[s.categoryId] || 0) + 1;
  }

  for (const [catId, count] of Object.entries(catBreakdown)) {
    if (y > H - 40) { newPage(); y = 30; }
    const cat = categories.find((c) => c.id === Number(catId));
    const pct = Math.round((count / slots.length) * 100);
    const barWidth = (pct / 100) * (CONTENT_W - 60);

    doc.setFontSize(8);
    doc.setTextColor(...hexToRgb(DARK));
    doc.text(cat?.name ?? "Altro", MARGIN + 4, y + 4);

    doc.setFillColor(...hexToRgb(SAGE_LIGHT));
    doc.roundedRect(MARGIN + 50, y, CONTENT_W - 60, 5, 1, 1, "F");
    doc.setFillColor(...hexToRgb(cat?.color ?? SAGE));
    doc.roundedRect(MARGIN + 50, y, Math.max(barWidth, 2), 5, 1, 1, "F");

    doc.setTextColor(...hexToRgb(GRAY));
    doc.text(`${count} (${pct}%)`, W - MARGIN, y + 4, { align: "right" });
    y += 9;
  }

  // CONTENT DETAIL PAGES
  const sortedSlots = [...slots].sort((a: any, b: any) => {
    if (!a.publishDate) return 1;
    if (!b.publishDate) return -1;
    return a.publishDate.localeCompare(b.publishDate);
  });

  let currentPlatformSection = "";

  for (const slot of sortedSlots) {
    const platformLabel = PLATFORMS[slot.platform] ?? slot.platform;

    if (slot.platform !== currentPlatformSection) {
      currentPlatformSection = slot.platform;
      newPage();
      y = 30;

      doc.setFillColor(...hexToRgb(clientColor));
      doc.roundedRect(MARGIN, y, CONTENT_W, 14, 3, 3, "F");
      doc.setFontSize(14);
      doc.setTextColor(...hexToRgb(WHITE));
      doc.text(platformLabel, MARGIN + 6, y + 10);
      y += 24;
    }

    if (y > H - 80) {
      newPage();
      y = 30;
    }

    const cat = categories.find((c: any) => c.id === slot.categoryId);
    const cardH = 60 + (slot.caption ? Math.min(Math.ceil(slot.caption.length / 80) * 4, 30) : 0);

    doc.setFillColor(250, 250, 250);
    doc.roundedRect(MARGIN, y, CONTENT_W, Math.min(cardH, H - y - 30), 3, 3, "F");
    doc.setDrawColor(...hexToRgb(SAGE_LIGHT));
    doc.roundedRect(MARGIN, y, CONTENT_W, Math.min(cardH, H - y - 30), 3, 3, "S");

    let cy = y + 6;

    // Date + time row
    doc.setFontSize(9);
    doc.setTextColor(...hexToRgb(SAGE_DARK));
    const dateLabel = slot.publishDate
      ? new Date(slot.publishDate + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })
      : "Data da definire";
    doc.text(dateLabel + (slot.publishTime ? ` ore ${slot.publishTime}` : ""), MARGIN + 5, cy);

    // Type badge
    const typeLabel = CONTENT_TYPES[slot.contentType] ?? slot.contentType;
    doc.setFillColor(...hexToRgb(SAGE));
    doc.roundedRect(MARGIN + CONTENT_W - 50, cy - 4, 22, 6, 1, 1, "F");
    doc.setFontSize(7);
    doc.setTextColor(...hexToRgb(WHITE));
    doc.text(typeLabel, MARGIN + CONTENT_W - 39, cy, { align: "center" });

    // Category badge
    if (cat) {
      doc.setFillColor(...hexToRgb(cat.color));
      doc.roundedRect(MARGIN + CONTENT_W - 25, cy - 4, 20, 6, 1, 1, "F");
      doc.setFontSize(6);
      doc.setTextColor(...hexToRgb(WHITE));
      doc.text(cat.name.substring(0, 12), MARGIN + CONTENT_W - 15, cy, { align: "center" });
    }
    cy += 8;

    // Title
    if (slot.title) {
      doc.setFontSize(10);
      doc.setTextColor(...hexToRgb(DARK));
      doc.text(slot.title, MARGIN + 5, cy);
      cy += 6;
    }

    // Caption
    if (slot.caption) {
      doc.setFontSize(8);
      doc.setTextColor(...hexToRgb(GRAY));
      const lines = doc.splitTextToSize(slot.caption, CONTENT_W - 15);
      const maxLines = Math.min(lines.length, 8);
      for (let i = 0; i < maxLines; i++) {
        doc.text(lines[i], MARGIN + 5, cy);
        cy += 3.5;
      }
      if (lines.length > 8) {
        doc.text("...", MARGIN + 5, cy);
        cy += 3.5;
      }
    }

    // Hashtags
    const hashtags = Array.isArray(slot.hashtagsJson) ? slot.hashtagsJson : [];
    if (hashtags.length > 0) {
      cy += 2;
      doc.setFontSize(7);
      doc.setTextColor(...hexToRgb(SAGE));
      const tagText = hashtags.join(" ");
      const tagLines = doc.splitTextToSize(tagText, CONTENT_W - 15);
      for (let i = 0; i < Math.min(tagLines.length, 2); i++) {
        doc.text(tagLines[i], MARGIN + 5, cy);
        cy += 3;
      }
    }

    // CTA
    if (slot.callToAction) {
      cy += 2;
      doc.setFontSize(7);
      doc.setTextColor(...hexToRgb(DARK));
      doc.text(`CTA: ${slot.callToAction}`, MARGIN + 5, cy);
      cy += 4;
    }

    // Visual description
    if (slot.visualDescription) {
      doc.setFontSize(7);
      doc.setTextColor(...hexToRgb(GRAY));
      doc.text(`Visual: ${slot.visualDescription.substring(0, 80)}`, MARGIN + 5, cy);
      cy += 4;
    }

    // Client notes
    if (slot.notesClient) {
      doc.setFontSize(7);
      doc.setTextColor(...hexToRgb(SAGE_DARK));
      doc.text(`Note: ${slot.notesClient.substring(0, 80)}`, MARGIN + 5, cy);
      cy += 4;
    }

    // Approval checkbox
    cy += 2;
    doc.setDrawColor(...hexToRgb(GRAY));
    doc.rect(MARGIN + 5, cy - 3, 3.5, 3.5);
    doc.setFontSize(7);
    doc.setTextColor(...hexToRgb(GRAY));
    doc.text("Approvato dal cliente", MARGIN + 11, cy);

    y = cy + 10;
  }

  // LAST PAGE — APPROVAL SIGN-OFF
  newPage();
  y = 60;

  doc.setFillColor(...hexToRgb(SAGE_DARK));
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...hexToRgb(SAGE));
  doc.rect(0, 0, W, 6, "F");

  doc.setFontSize(24);
  doc.setTextColor(...hexToRgb(WHITE));
  doc.text("APPROVAZIONE", W / 2, y, { align: "center" });
  y += 15;

  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(SAGE_LIGHT));
  doc.text("Il presente piano editoriale e stato revisionato e approvato da:", W / 2, y, { align: "center" });
  y += 25;

  doc.setDrawColor(...hexToRgb(SAGE));
  doc.line(MARGIN + 20, y, W - MARGIN - 20, y);
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(SAGE_LIGHT));
  doc.text("Nome e Cognome", MARGIN + 20, y + 5);
  y += 20;

  doc.line(MARGIN + 20, y, W - MARGIN - 20, y);
  doc.text("Firma", MARGIN + 20, y + 5);
  y += 20;

  doc.line(MARGIN + 20, y, W - MARGIN - 20, y);
  doc.text("Data", MARGIN + 20, y + 5);
  y += 25;

  doc.setFillColor(...hexToRgb(SAGE));
  doc.roundedRect(MARGIN + 20, y, CONTENT_W - 40, 30, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(WHITE));
  doc.text("Note / Feedback del cliente:", MARGIN + 25, y + 6);
  y += 50;

  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(SAGE));
  doc.text("Be Kind Social Agency", W / 2, H - 40, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(SAGE_LIGHT));
  doc.text("michaelballeroni@pec.it", W / 2, H - 34, { align: "center" });

  const filename = `Piano_Editoriale_${plan.clientName?.replace(/\s+/g, "_")}_${MONTHS[plan.month - 1]}_${plan.year}.pdf`;
  doc.save(filename);
}
