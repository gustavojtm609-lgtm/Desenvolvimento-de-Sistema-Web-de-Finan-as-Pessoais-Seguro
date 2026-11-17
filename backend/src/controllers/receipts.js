const path = require("node:path");
const { Receipt } = require("../models/receipt");
const { findTransaction } = require("./finance");
const { HttpError } = require("../lib/errors");
const allowed = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
async function upload(req, res) {
  const transaction = await findTransaction(req);
  if (!req.file)
    throw new HttpError(
      400,
      "Selecione um PDF ou uma imagem JPG, PNG ou WebP.",
    );
  const { fileTypeFromBuffer } = await import("file-type");
  let detected;
  try {
    detected = await fileTypeFromBuffer(req.file.buffer);
  } catch {
    /* Arquivo truncado. */
  }
  if (
    !detected ||
    !allowed.has(detected.mime) ||
    detected.mime !== req.file.mimetype
  ) {
    throw new HttpError(
      400,
      "O conteúdo não corresponde a um PDF ou imagem JPG, PNG ou WebP válido.",
    );
  }
  const extensions = {
    "application/pdf": [".pdf"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
  };
  const original = req.file.originalname
    .split(/[\\/]/)
    .pop()
    .replace(/[\x00-\x1f\x7f]/g, "");
  if (
    !extensions[detected.mime].includes(path.extname(original).toLowerCase())
  ) {
    throw new HttpError(
      400,
      "A extensão do arquivo não corresponde ao conteúdo.",
    );
  }
  const base = original.replace(/\.[^.]*$/, "").slice(0, 100) || "comprovante";
  const name = `${base}.${detected.ext}`;
  const values = {
    name,
    mimeType: detected.mime,
    size: req.file.size,
    data: req.file.buffer,
  };
  const existing = await Receipt.findOne({
    where: { expenseId: transaction.id },
  });
  const receipt = existing
    ? await existing.update(values)
    : await Receipt.create({ expenseId: transaction.id, ...values });
  res
    .status(201)
    .json({
      id: receipt.id,
      name,
      mimeType: detected.mime,
      size: req.file.size,
    });
}
async function download(req, res) {
  const transaction = await findTransaction(req);
  const receipt = await Receipt.unscoped().findOne({
    where: { expenseId: transaction.id },
  });
  if (!receipt) throw new HttpError(404, "Comprovante não encontrado.");
  const extension = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  }[receipt.mimeType];
  res.set({
    "Content-Type": receipt.mimeType,
    "Content-Disposition": `attachment; filename="comprovante-${receipt.id}.${extension}"`,
    "Content-Length": String(receipt.size),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "no-store",
  });
  res.send(receipt.data);
}
async function remove(req, res) {
  const transaction = await findTransaction(req);
  await Receipt.destroy({ where: { expenseId: transaction.id } });
  res.status(204).end();
}
module.exports = { upload, download, remove };
