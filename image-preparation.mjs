export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function validatePhotoSource(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) throw Error('Tire ou escolha uma foto do placar para continuar.');
  if (!PHOTO_TYPES.has(file.type) && !(file.type === '' && /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name || ''))) throw Error('Escolha uma foto JPG, PNG, WebP ou HEIC.');
  if (file.size > MAX_SOURCE_BYTES) throw Error('A foto ultrapassa 30 MB. Escolha uma foto menor ou tire outra foto do placar.');
}

export function photoDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > 100000000) throw Error('Não foi possível preparar esta foto. Tire uma nova foto do placar.');
  const scale = Math.min(1, 2200 / Math.max(width, height), Math.sqrt(2000000 / (width * height)));
  return {width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale))};
}

async function decodePhoto(file) {
  try { return await createImageBitmap(file, {imageOrientation: 'from-image'}); } catch {}
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    return {width: img.naturalWidth, height: img.naturalHeight, drawable: img, close() { URL.revokeObjectURL(url); }};
  } catch {
    URL.revokeObjectURL(url);
    throw Error(/heic|heif/i.test(file.type + file.name) ? 'Seu navegador não consegue abrir esta foto HEIC. Tire a foto pelo botão “Tirar foto” ou exporte como JPG no celular.' : 'Não foi possível abrir a foto. Tente tirar outra foto do placar ou escolher um JPG.');
  }
}

export async function preparePhoto(file, {local = false} = {}) {
  validatePhotoSource(file);
  const image = await decodePhoto(file);
  try {
    const dimensions = photoDimensions(image.width, image.height), canvas = document.createElement('canvas');
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext('2d'); if (!context) throw Error('Não foi possível preparar a foto neste navegador.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image.drawable || image, 0, 0, canvas.width, canvas.height);
    const limit = local ? 330000 : MAX_UPLOAD_BYTES;
    let blob;
    for (const quality of [.9, .8, .65, .5, .35, .2]) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= limit) break;
    }
    if (!blob || blob.size > limit) throw Error('A foto ainda está grande após o ajuste. Fotografe só a tela com o placar, sem cortar os números.');
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('Não foi possível preparar a foto.')); reader.readAsDataURL(blob); });
    return {dataUrl, blob, name: 'placar.jpg'};
  } finally { image.close(); }
}
