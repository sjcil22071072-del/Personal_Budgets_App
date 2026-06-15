/**
 * Client-side image compression utility.
 * Compresses an image file by drawing it onto a canvas and exporting it as a JPEG with specified quality.
 * Uses naturalWidth and naturalHeight to prevent EXIF orientation layout bugs.
 * Designed to be completely fail-proof with nested try-catch blocks.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<File> {
  // If the file is not an image, return it as-is
  if (!file.type.startsWith('image/')) {
    return file
  }

  // Only compress if the file size is larger than 800KB (819200 bytes)
  if (file.size < 800 * 1024) {
    return file
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const img = new Image()
          img.onload = () => {
            try {
              // Use naturalWidth and naturalHeight which are auto-oriented by modern browsers
              const naturalWidth = img.naturalWidth
              const naturalHeight = img.naturalHeight

              if (naturalWidth === 0 || naturalHeight === 0) {
                resolve(file)
                return
              }

              let width = naturalWidth
              let height = naturalHeight

              // Calculate new dimensions while maintaining aspect ratio perfectly
              if (width > height) {
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width)
                  width = maxWidth
                }
              } else {
                if (height > maxHeight) {
                  width = Math.round((width * maxHeight) / height)
                  height = maxHeight
                }
              }

              const canvas = document.createElement('canvas')
              canvas.width = width
              canvas.height = height

              const ctx = canvas.getContext('2d')
              if (!ctx) {
                resolve(file) // Fallback to original file
                return
              }

              // Fill background with white to handle transparent PNGs
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, 0, width, height)

              ctx.drawImage(img, 0, 0, width, height)

              canvas.toBlob(
                (blob) => {
                  try {
                    if (blob) {
                      const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                      })
                      resolve(compressedFile)
                    } else {
                      resolve(file)
                    }
                  } catch (toBlobError) {
                    // Fallback if File constructor is not supported in this WebView
                    if (blob) {
                      const fallbackFile = blob as any
                      fallbackFile.name = file.name.replace(/\.[^/.]+$/, "") + ".jpg"
                      fallbackFile.lastModified = Date.now()
                      resolve(fallbackFile)
                    } else {
                      resolve(file)
                    }
                  }
                },
                'image/jpeg',
                quality
              )
            } catch (onloadError) {
              resolve(file)
            }
          }
          img.onerror = () => resolve(file)
          img.src = e.target?.result as string
        } catch (readerOnloadError) {
          resolve(file)
        }
      }
      reader.onerror = () => resolve(file)
      reader.readAsDataURL(file)
    } catch (outerError) {
      resolve(file)
    }
  })
}
