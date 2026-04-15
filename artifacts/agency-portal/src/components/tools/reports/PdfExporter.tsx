export async function exportReportPdf(element: HTMLElement, filename: string): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js");
  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: {
      unit: "mm" as const,
      format: "a4" as const,
      orientation: "portrait" as const,
    },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };
  await html2pdf().set(opt).from(element).save();
}
