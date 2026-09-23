import "./globals.css";

export const metadata = {
  title: "EHGA Mobility Operations",
  description:
    "EHGA Mobility staff operations system: bookings, dispatch, parcels, trips, fuel, fleet, private hire, school transport and cash reconciliation.",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f5c46",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
