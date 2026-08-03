export function exportCSV(filename: string, rows: Record<string, string | number | undefined>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h] ?? "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

export async function exportPDF(filename: string, title: string, rows: Record<string, string | number | undefined>[]) {
  const { jsPDF } = await import("jspdf");
  const autoTableMod: any = await import("jspdf-autotable");
  const autoTable = autoTableMod.default || autoTableMod;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text(title, 14, 16);
  doc.setFontSize(10); doc.text(new Date().toLocaleString(), 14, 23);
  if (rows.length) {
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });
  }
  doc.save(filename);
}
