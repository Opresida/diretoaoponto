import { useState } from "react";
import { auth } from "./lib/api.js";
import Login from "./components/Login.jsx";
import ManagerDashboard from "./components/ManagerDashboard.jsx";

// App do Gerente — apuração exclusiva da zona dele. A apuração GERAL fica no Admin.
export default function App() {
  const [user, setUser] = useState(auth.user?.role === "manager" ? auth.user : null);
  if (!user) return <Login onLogin={setUser} />;
  return <ManagerDashboard user={user} onLogout={() => { auth.clear(); setUser(null); }} />;
}
