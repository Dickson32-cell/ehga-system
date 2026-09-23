import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppNav from "./AppNav";
import LogoutButton from "./LogoutButton";
import ChangePassword from "./ChangePassword";

export const dynamic = "force-dynamic";

const ROLE_LABEL = {
  MANAGING_DIRECTOR: "Managing Director",
  OPERATIONS_MANAGER: "Operations Manager",
  DISPATCHER: "Dispatcher",
  ACCOUNTANT: "Accountant",
  DRIVER: "Driver",
  RIDER: "Rider",
};

export default async function AppLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">EHGA Mobility</span>
          <span className="brand-sub">Operations System</span>
        </div>
        <div className="userbox">
          <div className="who">
            <b>{session.full_name || session.username}</b>
            {ROLE_LABEL[session.role] || session.role}
          </div>
          <LogoutButton />
        </div>
      </header>
      <AppNav role={session.role} />
      <main className="page">
        {session.must_change_password ? <ChangePassword required /> : null}
        {children}
      </main>
      <footer className="footer">
        <span>EHGA Mobility - Koforidua / Accra passenger, parcel and private-hire operations</span>
        <span>All amounts in Ghana Cedis (GHS)</span>
      </footer>
    </div>
  );
}
