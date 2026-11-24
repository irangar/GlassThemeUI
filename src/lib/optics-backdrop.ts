import type { Gradient } from "./backgrounds";

export type OpticalBackdrop = {
  gradient: Gradient;
  imageUrl?: string | null;
  pattern?: "text" | "motion";
  playing?: boolean;
  dimmed?: boolean;
};

function paintGradient(context: CanvasRenderingContext2D, gradient: Gradient, width: number, height: number) {
  const [start, middle, end] = gradient.colors;
  const angle = gradient.angle * Math.PI / 180;
  const x = Math.sin(angle);
  const y = -Math.cos(angle);
  const reach = (Math.abs(width * x) + Math.abs(height * y)) / 2;
  const base = context.createLinearGradient(width / 2 - x * reach, height / 2 - y * reach,
    width / 2 + x * reach, height / 2 + y * reach);
  base.addColorStop(0.04, start);
  base.addColorStop(0.43, middle);
  base.addColorStop(0.49, end);
  base.addColorStop(0.51, middle);
  base.addColorStop(0.57, start);
  base.addColorStop(1, middle);
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  const rx = 0.78 * width * Math.SQRT2;
  const ry = 0.91 * height * Math.SQRT2;
  context.save();
  context.translate(0.78 * width, 0.09 * height);
  context.scale(rx, ry);
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, 0.52);
  glow.addColorStop(0, `${end}88`);
  glow.addColorStop(1, `${end}00`);
  context.fillStyle = glow;
  context.fillRect(-2, -2, 4, 4);
  context.restore();
}

export function paintBackdrop(
  canvas: HTMLCanvasElement,
  bounds: DOMRect,
  scale: number,
  scene: OpticalBackdrop,
  image: HTMLImageElement | null,
  time: number,
) {
  const width = bounds.width;
  const height = bounds.height;
  const pixelsWide = Math.max(1, Math.round(width * scale));
  const pixelsHigh = Math.max(1, Math.round(height * scale));
  if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
  if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  context.setTransform(pixelsWide / width, 0, 0, pixelsHigh / height, 0, 0);
  paintGradient(context, scene.gradient, width, height);
  if (image?.naturalWidth) {
    const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * cover;
    const h = image.naturalHeight * cover;
    context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  }
  if (scene.pattern === "text") {
    const band = height / 4;
    const words = ["REFRACTION", "TRANSMISSION", "REFLECTION", "CONCENTRATION"];
    context.textBaseline = "middle";
    context.font = `800 ${Math.min(width / 9, band * 0.67)}px system-ui, sans-serif`;
    words.forEach((word, index) => {
      context.fillStyle = index % 2 ? "#182024" : "#edece3";
      context.fillRect(0, index * band, width, band + 0.5);
      context.fillStyle = index % 2 ? "#edece3" : "#182024";
      const x = (index % 2 ? 0.17 : 0.042) * width;
      context.fillText(word, x, (index + 0.52) * band, width - x - width * 0.042);
    });
  }
  if (scene.pattern === "motion") {
    const unit = Math.min(width, height);
    const x = width * (0.5 + 0.37 * Math.sin(time * 0.83));
    const y = height * (0.49 + 0.23 * Math.sin(time * 1.06 + 0.85));
    context.strokeStyle = "#ffffff24";
    context.lineWidth = 1;
    for (let i = 28; i < Math.max(width, height); i += 28) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, height);
      context.moveTo(0, i);
      context.lineTo(width, i);
      context.stroke();
    }
    context.fillStyle = "#f8e7b4";
    context.beginPath();
    context.arc(x, y, unit * 0.116, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(width - x, height - y);
    context.rotate(time * 0.66 + 0.35);
    context.fillStyle = "#92cdbf";
    context.fillRect(-unit * 0.092, -unit * 0.092, unit * 0.184, unit * 0.184);
    context.fillStyle = "#17272c";
    context.fillRect(-unit * 0.058, -unit * 0.058, unit * 0.116, unit * 0.116);
    context.restore();
  }
  if (scene.dimmed) {
    context.fillStyle = "#0004";
    context.fillRect(0, 0, width, height);
  }
}
