import { useEffect, useState, useCallback } from "react";
import { auth, api } from "./lib/api.js";
import { getGps } from "./lib/gps.js";
import { receiptCode } from "./lib/receipt.js";
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
    const gpsStart = (await getGps()) || { lat: 0, lng: 0 };
    setDraft({ clientUuid: crypto.randomUUID(), startedAt: new Date().toISOString(), gpsStart });
    setScreen("triagem");
  };

  const finalize = async ({ photos, consentPhoto }) => {
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

  if (screen === "login")
    return <Login onLogin={(u) => { setUser(u); setScreen("home"); }} />;

  if (screen === "home")
    return (
      <Home user={user} pkg={pkg} pending={pending} online={online} syncing={syncing}
        onStart={startInterview} onSync={doSync}
        onLogout={() => { auth.clear(); setUser(null); setScreen("login"); }} />
    );

  if (screen === "triagem")
    return (
      <Triagem pkg={pkg}
        onDone={(d) => { setDraft((cur) => ({ ...cur, ...d })); setScreen("consent"); }}
        onCancel={() => setScreen("home")} />
    );

  if (screen === "consent")
    return <ConsentLGPD onAgree={() => setScreen("questionario")} onCancel={() => setScreen("home")} />;

  if (screen === "questionario")
    return (
      <Questionario pkg={pkg}
        onDone={(answers) => { setDraft((cur) => ({ ...cur, answers })); setScreen("fotos"); }}
        onCancel={() => setScreen("home")} />
    );

  if (screen === "fotos")
    return (
      <CapturaFotos gps={draft?.gpsStart}
        onConcluir={(fotos) => finalize({ photos: fotos, consentPhoto: true })}
        onPular={() => finalize({ photos: [], consentPhoto: false })} />
    );

  if (screen === "recibo")
    return (
      <ReciboEntrevista code={recibo.code} synced={recibo.synced} portalUrl={window.location.origin}
        onDone={() => { setRecibo(null); setDraft(null); setScreen("home"); }} />
    );

  return null;
}
