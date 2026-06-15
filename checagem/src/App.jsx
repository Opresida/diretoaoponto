import { useState } from "react";
import { auth } from "./lib/api.js";
import Login from "./components/Login.jsx";
import Checagem from "./components/Checagem.jsx";

export default function App() {
  const [user, setUser] = useState(auth.user);
  if (!user) return <Login onLogin={setUser} />;
  return <Checagem user={user} onLogout={() => { auth.clear(); setUser(null); }} />;
}
