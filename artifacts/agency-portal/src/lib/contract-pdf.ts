/**
 * Esporta un elemento DOM in PDF (A4 multipagina) con html2canvas + jsPDF.
 */
export async function exportContractElementToPdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const toDataUrl = (url: string): Promise<string> =>
    fetch(url)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => "");

  const images = element.querySelectorAll("img");
  const origSrcs: { img: HTMLImageElement; src: string }[] = [];
  const inlinePromises: Promise<void>[] = [];
  images.forEach((img) => {
    const src = img.src;
    if (src && (src.startsWith("http") || src.includes("/logo"))) {
      origSrcs.push({ img, src });
      inlinePromises.push(
        toDataUrl(src).then((dataUrl) => {
          if (dataUrl) img.src = dataUrl;
        }),
      );
    }
  });
  await Promise.all(inlinePromises);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 15000,
  });

  origSrcs.forEach(({ img, src }) => {
    img.src = src;
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = pdfWidth / imgWidth;
  const totalHeight = imgHeight * ratio;

  let position = 0;
  let page = 0;

  while (position < totalHeight) {
    if (page > 0) pdf.addPage();

    const srcY = position / ratio;
    const srcH = Math.min(pdfHeight / ratio, imgHeight - srcY);
    const destH = srcH * ratio;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = imgWidth;
    pageCanvas.height = Math.ceil(srcH);
    const ctx = pageCanvas.getContext("2d")!;
    ctx.drawImage(canvas, 0, srcY, imgWidth, srcH, 0, 0, imgWidth, srcH);

    const pageData = pageCanvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(pageData, "JPEG", 0, 0, pdfWidth, destH);

    const pageNum = page + 1;
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`Contratto · Pagina ${pageNum}`, pdfWidth / 2, pdfHeight - 5, { align: "center" });

    position += pdfHeight;
    page++;
  }

  pdf.save(fileName);
}
