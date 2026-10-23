import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import multer from 'multer'

export const UPLOADS_ROOT = path.join(process.cwd(), 'src', 'uploads')
const PRODUTOS_DIR = path.join(UPLOADS_ROOT, 'produtos')
const NOTAS_FISCAIS_DIR = path.join(UPLOADS_ROOT, 'notas-fiscais')
const RECEBIMENTOS_DIR = path.join(UPLOADS_ROOT, 'recebimentos')

fs.mkdirSync(PRODUTOS_DIR, { recursive: true })
fs.mkdirSync(NOTAS_FISCAIS_DIR, { recursive: true })
fs.mkdirSync(RECEBIMENTOS_DIR, { recursive: true })

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

function createImageUploader(destination: string, fieldName: string) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => {
      const ext = ALLOWED_MIME_TYPES[file.mimetype] ?? path.extname(file.originalname)
      cb(null, `${crypto.randomUUID()}${ext}`)
    },
  })

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES[file.mimetype]) {
        cb(new Error('Formato de imagem não suportado — use JPEG, PNG ou WEBP'))
        return
      }
      cb(null, true)
    },
  }).single(fieldName)
}

export const uploadProductPhoto = createImageUploader(PRODUTOS_DIR, 'photo')
export const uploadInvoicePhoto = createImageUploader(NOTAS_FISCAIS_DIR, 'invoice')
export const uploadReceiptPhoto = createImageUploader(RECEBIMENTOS_DIR, 'photo')

export function uploadErrorMessage(err: unknown): string {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return 'Imagem muito grande — máximo 5MB'
  if (err instanceof Error) return err.message
  return 'Não foi possível enviar a imagem'
}

export function deleteUploadedFile(relativePath: string) {
  const fullPath = path.join(UPLOADS_ROOT, relativePath)
  if (!fullPath.startsWith(UPLOADS_ROOT)) return
  fs.rm(fullPath, { force: true }, () => {})
}
