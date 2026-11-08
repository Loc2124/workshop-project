export async function downloadQrPng(svg: SVGSVGElement, filename: string) {
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], {
      type: 'image/svg+xml;charset=utf-8',
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Chưa tải được mã.');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 600, 600);
    context.drawImage(image, 30, 30, 540, 540);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
