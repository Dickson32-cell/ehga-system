import "./globals.css";

export const metadata = {
  other: { google: "notranslate" },
  title: "EHGA Mobility — Seats, parcels & private hire on the Eastern corridor",
  description:
    "Book seats Koforidua–Accra, send parcels, hire a car or arrange school transport. Tracked live, start to finish. Pay by MoMo.",
  manifest: "/manifest.json",
  openGraph: {
    title: "EHGA Mobility — Seats, parcels & private hire on the Eastern corridor",
    description:
      "Book seats Koforidua–Accra, send parcels, hire a car or arrange school transport. Tracked live, start to finish. Pay by MoMo.",
    images: [{ url: "/og-card.png", width: 1200, height: 630, alt: "EHGA Mobility — the road, run properly" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EHGA Mobility — Seats, parcels & private hire on the Eastern corridor",
    description: "Tracked live, start to finish. Koforidua–Accra and within-city rides.",
    images: ["/og-card.png"],
  },
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
