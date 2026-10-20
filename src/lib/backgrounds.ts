export type Gradient = {
  name: string;
  colors: readonly [string, string, string];
  angle: number;
};

export const GRADIENTS: readonly Gradient[] = [
  { name: "Graphite", colors: ["#17181b", "#55565a", "#202124"], angle: 135 },
  { name: "Dusk", colors: ["#30253e", "#b77d88", "#e9b599"], angle: 135 },
  { name: "Moss", colors: ["#182e2b", "#6e8c74", "#c9c5a5"], angle: 135 },
  { name: "Ember", colors: ["#341e23", "#a85f46", "#e8bd88"], angle: 125 },
  { name: "Iris", colors: ["#29233e", "#8274b1", "#d2b5cb"], angle: 135 },
  { name: "Pearl", colors: ["#47474a", "#b1a9a2", "#e7ded3"], angle: 140 },
];

export function gradientBackground(gradient: Gradient): string {
  const [start, middle, end] = gradient.colors;
  return [
    `radial-gradient(ellipse at 78% 9%, ${end}88 0%, transparent 52%)`,
    `linear-gradient(${gradient.angle}deg, ${start} 4%, ${middle} 43%, ${end} 49%, ${middle} 51%, ${start} 57%, ${middle} 100%)`,
  ].join(", ");
}

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export function imageValidationError(file: Pick<File, "type" | "size">): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPG, PNG, WebP, AVIF, or GIF image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "This image is too large. Please choose one smaller than 20 MB.";
  }
  if (file.size === 0) {
    return "This image is empty. Please choose another file.";
  }
  return null;
}
