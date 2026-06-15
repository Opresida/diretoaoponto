// Gravação de áudio da entrevista (MediaRecorder, offline). Opcional: se o
// microfone for negado/indisponível, retorna null e a entrevista segue sem áudio.
export async function startRecorder() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return null;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null; // permissão negada ou sem microfone
  }
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  rec.start();

  const finish = (resolve, keep) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(keep && chunks.length ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null);
    };
    try { rec.stop(); } catch { stream.getTracks().forEach((t) => t.stop()); resolve(null); }
  };

  return {
    /** Para e retorna o Blob do áudio. */
    stop: () => new Promise((resolve) => finish(resolve, true)),
    /** Para e descarta (cancelamento da entrevista). */
    cancel: () => new Promise((resolve) => finish(resolve, false)),
  };
}
