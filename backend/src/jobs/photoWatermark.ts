// Job BullMQ: photo:watermark — PROMPT §5 (passo 8).
// Desenha timestamp + GPS na imagem (o app já faz um carimbo client-side §8;
// este job re-aplica server-side autoritativo e regrava a key).
// TODO: definir Queue/Worker BullMQ (REDIS_URL) e processador (sharp/canvas).
export const PHOTO_WATERMARK_QUEUE = "photo:watermark";
