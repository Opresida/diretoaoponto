import { useEffect, useState, useCallback, useRef } from "react";
import { Mic } from "lucide-react";
import { auth, api } from "./lib/api.js";
import { getGps } from "./lib/gps.js";
import { receiptCode } from "./lib/receipt.js";
import { startRecorder } from "./lib/recorder.js";
import { enqueue, syncPending, getPending } from "./lib/db.js";
import Login from "./components/Login.jsx";
import Home from "./components/Home.jsx";
import Triagem from "./components/Triagem.jsx";
import ConsentLGPD from "./components/ConsentLGPD.jsx";
import CapturaFotos from "./components/CapturaFotos.jsx";
import Questionario from "./components/Questionario.jsx";
import ReciboEntrevista from "./components/ReciboEntrevista.jsx";

export default function App() {
  const [user, setUser] = useState(auth.user);
  const [screen, setScreen] = useState(auth.token ? "home" : "login");
  const [pkg, setPkg] = useState(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);

  const refreshPending = useCallback(async () => setPending((await getPending()).length), []);

  const loadPackage = useCallback(async () => {
    try {
      setPkg(await api.fieldPackage());
    } catch (e) {
      if (e.status === 401) {
        auth.clear();
        setUser(null);
        setScreen("login");
      }
    }
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadPackage();
      refreshPending();
    }
  }, [user, loadPackage, refreshPending]);

  // Auto-sync: ao carregar com pendências e ao voltar a ficar online.
  useEffect(() => {
    if (online && pending > 0 && user && !syncing) doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending, user]);

  const doSync = async () => {
    setSyncing(true);
    try {
      await syncPending();
      await refreshPending();
      await loadPackage();
    } finally {
      setSyncing(false);
    }
  };

  const startInterview = async () => {
    // Inicia a gravação da entrevista (opcional — segue sem áudio se negado).
    recorderRef.current = await startRecorder();
    setRecording(!!recorderRef.current);
    const gpsStart = (await getGps()) || { lat: 0, lng: 0 };
    setDraft({ clientUuid: crypto.randomUUID(), startedAt: new Date().toISOString(), gpsStart });
    setScreen("triagem");
  };

  const cancelInterview = async () => {
    if (recorderRef.current) { await recorderRef.current.cancel(); recorderRef.current = null; }
    setRecording(false);
    setDraft(null);
    setScreen("home");
  };

  const finalize = async ({ photos, consentPhoto }) => {
    const audioBlob = recorderRef.current ? await recorderRef.current.stop() : null;
    recorderRef.current = null;
    setRecording(false);
    const endedAt = new Date().toISOString();
    const gpsEnd = (await getGps()) || draft.gpsStart;
    const year = new Date(draft.startedAt).getFullYear();
    const code = await receiptCode(draft.clientUuid, year);
    const interview = {
      clientUuid: draft.clientUuid,
      stratumId: draft.stratumId,
      quotaId: draft.quotaId,
      respondent: draft.respondent,
      consentLgpd: true,
      consentPhoto,
      startedAt: draft.startedAt,
      endedAt,
      gpsStart: draft.gpsStart,
      gpsEnd,
      photos: (photos ?? []).map((p, i) => ({ seq: i + 1, dataUrl: p.dataUrl, takenAt: p.takenAt, gps: p.gps })),
      audioBlob, // Blob (webm) ou null — persiste no IndexedDB e sobe no sync
      answers: draft.answers ?? [],
      receiptCode: code,
    };
    await enqueue(interview);
    if (navigator.onLine) await doSync();
    else await refreshPending();
    const stillPending = (await getPending()).some((i) => i.clientUuid === draft.clientUuid);
    setRecibo({ code, synced: !stillPending });
    setScreen("recibo");
  };

  let el = null;
  if (screen === "login") {
    el = <Login onLogin={(u) => { setUser(u); setScreen("home"); }} />;
  } else if (screen === "home") {
    el = (
      <Home user={user} pkg={pkg} pending={pending} online={online} syncing={syncing}
        onStart={startInterview} onSync={doSync}
        onLogout={() => { auth.clear(); setUser(null); setScreen("login"); }} />
    );
  } else if (screen === "triagem") {
    el = (
      <Triagem pkg={pkg}
        onDone={(d) => { setDraft((cur) => ({ ...cur, ...d })); setScreen("consent"); }}
        onCancel={cancelInterview} />
    );
  } else if (screen === "consent") {
    el = <ConsentLGPD onAgree={() => setScreen("questionario")} onCancel={cancelInterview} />;
  } else if (screen === "questionario") {
    el = (
      <Questionario pkg={pkg}
        onDone={(answers) => { setDraft((cur) => ({ ...cur, answers })); setScreen("fotos"); }}
        onCancel={cancelInterview} />
    );
  } else if (screen === "fotos") {
    el = (
      <CapturaFotos gps={draft?.gpsStart}
        onConcluir={(fotos) => finalize({ photos: fotos, consentPhoto: true })}
        onPular={() => finalize({ photos: [], consentPhoto: false })} />
    );
  } else if (screen === "recibo") {
    el = (
      <ReciboEntrevista code={recibo.code} synced={recibo.synced} portalUrl={window.location.origin}
        onDone={() => { setRecibo(null); setDraft(null); setScreen("home"); }} />
    );
  }

  return (
    <>
      {recording && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 text-xs font-semibold text-rose-200 bg-rose-900/70 border border-rose-700 rounded-full px-3 py-1 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-rose-400 opacity-70" />
            <span className="relative rounded-full h-2 w-2 bg-rose-400" />
          </span>
          <Mic size={12} /> Gravando áudio
        </div>
      )}
      {el}
    </>
  );
}
