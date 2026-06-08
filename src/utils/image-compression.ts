/**
 * Client-side image compression utility.
 * Bypasses canvas compression to prevent EXIF orientation bugs that crop and stretch images.
 * Returns the original file as-is.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<File> {
  return file
}
