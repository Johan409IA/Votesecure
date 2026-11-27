// Prepara la foto de perfil en el navegador antes de subirla.
// El backend acepta como máximo 100 kb por petición JSON (express.json), así que
// la imagen se recorta en cuadrado, se reduce y se comprime a JPEG.
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;
const LIMITE_CARACTERES = 90_000; // deja margen bajo los 100 kb del servidor

export async function prepararFoto(archivo) {
  if (!TIPOS_FOTO.includes(archivo.type)) {
    throw new Error('Usa una imagen JPG, PNG o WebP.');
  }
  if (archivo.size > MAX_BYTES_FOTO) {
    throw new Error('La imagen pesa más de 5 MB. Elige una más liviana.');
  }

  let imagen;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con otra.');
  }

  // Recorte cuadrado centrado.
  const lado = Math.min(imagen.width, imagen.height);
  const origenX = (imagen.width - lado) / 2;
  const origenY = (imagen.height - lado) / 2;

  for (const tamano of [256, 200, 160]) {
    const lienzo = document.createElement('canvas');
    lienzo.width = tamano;
    lienzo.height = tamano;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff'; // los PNG con transparencia quedan sobre blanco
    ctx.fillRect(0, 0, tamano, tamano);
    ctx.drawImage(imagen, origenX, origenY, lado, lado, 0, 0, tamano, tamano);
    for (const calidad of [0.85, 0.7, 0.55]) {
      const url = lienzo.toDataURL('image/jpeg', calidad);
      if (url.length <= LIMITE_CARACTERES) {
        imagen.close?.();
        return url;
      }
    }
  }
  imagen.close?.();
  throw new Error('No se pudo reducir la imagen lo suficiente. Prueba con otra.');
}
