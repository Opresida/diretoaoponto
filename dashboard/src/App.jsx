import { useState } from "react";
import { auth } from "./lib/api.js";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ManagerDashboard from "./components/ManagerDashboard.jsx";

export default function App() {
  const [user, setUser] = useState(auth.user);
  const logout = () => { auth.clear(); setUser(null); };
  if (!user) return <Login onLogin={setUser} />;
  // Gerente vê exclusivamente a zona dele; demais (coordinator/admin/estatístico) veem tudo.
  if (user.role === "manager") return <ManagerDashboard user={user} onLogout={logout} />;
  return <Dashboard user={user} onLogout={logout} />;
}
