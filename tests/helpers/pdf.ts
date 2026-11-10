/** Build a minimal, valid single-page PDF with a Helvetica text line. Test-only. */
export function makeTestPdf(lines: string[]): Uint8Array {
  const escapeText = (value: string) => value.replace(/[()\\]/g, "\\$&");
  const ops = lines
    .map(
      (line, index) =>
        `BT /F1 12 Tf 72 ${720 - index * 18} Td (${escapeText(line)}) Tj ET`,
    )
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(out, "latin1"));
}
