import { useState } from "react";
import { auth } from "./lib/api.js";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  const [user, setUser] = useState(auth.user);
  if (!user) return <Login onLogin={setUser} />;
  return <Dashboard user={user} onLogout={() => { auth.clear(); setUser(null); }} />;
}
