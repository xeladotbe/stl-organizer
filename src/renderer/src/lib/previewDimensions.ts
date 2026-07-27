export const DEFAULT_PREVIEW_WIDTH = 288; // w-80 minus padding = 320 - 32
export const PREVIEW_ASPECT_RATIO = DEFAULT_PREVIEW_WIDTH / 256; // width / default height

export function calculatePreviewHeight(width: number): number {
  const previewAreaWidth = Math.max(width - 24, 100); // Subtract padding
  return Math.round(previewAreaWidth / PREVIEW_ASPECT_RATIO);
}
