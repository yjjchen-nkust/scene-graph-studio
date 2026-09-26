// Vite resolves these at build time and emits them as assets on this origin, so a playground
// draws a photograph with no backend running. F1 and F3 draw the same six.
const IMAGES = import.meta.glob('../../../../data/slices/placeholder/images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** The bundled URL of a placeholder frame's photograph, or '' if the slice has none by that id. */
export function placeholderImageUrl(imageId: string): string {
  const hit = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${imageId}.png`));
  return hit?.[1] ?? '';
}
