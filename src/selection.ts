// Pure selection geometry from LectureTutor.
export function boundedClip(rect: number[], bounds: number[]) {
  if (!validClip(rect) || !validClip(bounds)) {
    throw new RangeError("expected finite, ordered rectangles at least four units wide and high");
  }
  const [left, bottom, right, top] = bounds;
  const width = Math.max(4, Math.min(right - left, rect[2] - rect[0]));
  const height = Math.max(4, Math.min(top - bottom, rect[3] - rect[1]));
  const x = Math.max(left, Math.min(right - width, rect[0]));
  const y = Math.max(bottom, Math.min(top - height, rect[1]));
  return [x, y, x + width, y + height];
}
export function validClip(rect: number[] | null): rect is number[] {
  return Boolean(
    rect &&
    rect.length === 4 &&
    rect.every(Number.isFinite) &&
    rect[2] - rect[0] >= 4 &&
    rect[3] - rect[1] >= 4,
  );
}
