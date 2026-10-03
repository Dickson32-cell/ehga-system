import Link from "next/link";
import DriverApplyForm from "./DriverApplyForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Drive with EHGA Mobility — Driver Application",
  description:
    "Apply to drive for EHGA Mobility. Upload your licence, Ghana Card and vehicle documents — approval within 48 hours.",
};

export default function DriverApplyPage() {
  return (
    <div className="login-wrap driver-apply-wrap">
      <div className="login-card driver-apply-card">
        <div className="wordmark">
          <h1>Drive with us</h1>
          <p>Driver application — approval within 48 hours</p>
        </div>
        <DriverApplyForm />
        <p style={{ margin: "1.1rem 0 0", fontSize: "0.86rem", textAlign: "center", fontFamily: "system-ui, sans-serif", color: "var(--ink-soft)" }}>
          Already approved?{" "}
          <Link href="/login" style={{ color: "var(--good)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}