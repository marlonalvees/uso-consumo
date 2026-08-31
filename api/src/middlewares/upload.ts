import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import multer from 'multer'

export const UPLOADS_ROOT = path.join(process.cwd(), 'src', 'uploads')
const PRODUTOS_DIR = path.join(UPLOADS_ROOT, 'produtos')

fs.mkdirSync(PRODUTOS_DIR, { recursive: true })

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRODUTOS_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] ?? path.extname(file.originalname)
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

export const uploadProductPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new Error('Formato de imagem não suportado — use JPEG, PNG ou WEBP'))
      return
    }
    cb(null, true)
  },
}).single('photo')

export function deleteProductPhoto(photoPath: string) {
  const fullPath = path.join(UPLOADS_ROOT, photoPath)
  if (!fullPath.startsWith(UPLOADS_ROOT)) return
  fs.rm(fullPath, { force: true }, () => {})
}
