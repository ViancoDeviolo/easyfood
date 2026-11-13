// Middleware de upload com Multer, compartilhado por todos os módulos que recebem imagens.
//
// - memoryStorage: o arquivo fica só na memória; quem decide onde gravar é o image.service
//   (nada de arquivo temporário solto no disco com nome escolhido pelo cliente).
// - limits: tamanho máximo e um único arquivo por requisição.
// - fileFilter: primeira barreira pelo Content-Type declarado. A checagem definitiva
//   é feita depois pelos bytes do arquivo (image.service), porque o tipo declarado pode mentir.

const multer = require("multer");
const {
  ValidationError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError
} = require("../errors/app-error");
const { ALLOWED_MIME_TYPES } = require("./image-format");

const FIELD_NAME = "image";

function createUploadMiddleware({ maxBytes }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 5 },
    fileFilter: (req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return callback(new UnsupportedMediaTypeError("Envie uma imagem JPEG, PNG ou WebP"));
      }
      callback(null, true);
    }
  }).single(FIELD_NAME);

  const maxMb = Math.round(maxBytes / 1024 / 1024);

  // Converte os erros do Multer em erros de aplicação (status HTTP corretos)
  return function uploadImage(req, res, next) {
    upload(req, res, (error) => {
      if (!error) {
        if (!req.file) return next(new ValidationError(`Envie a imagem no campo "${FIELD_NAME}" (multipart/form-data)`));
        return next();
      }
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") return next(new PayloadTooLargeError(`A imagem deve ter no máximo ${maxMb} MB`));
        return next(new ValidationError(`Upload inválido: envie um único arquivo no campo "${FIELD_NAME}"`));
      }
      return next(error);
    });
  };
}

module.exports = { createUploadMiddleware, FIELD_NAME };
