import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Panel - Masjid As Sunnah",
  description: "Admin dashboard for Masjid As Sunnah",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The browser mutates <html> before React hydrates — a theme/design
    // extension injects data-theme, data-density, data-motion, data-pattern and
    // an inline style. The server renders a bare <html lang="en">, so React saw
    // a mismatch and refused to hydrate. This attribute only silences
    // mismatches on <html> itself; the rest of the tree still hydrates normally.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Lato:wght@400;700&family=Manrope:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;500;600;700&family=Raleway:wght@400;600;700&family=Roboto:wght@400;500;700&family=Rubik:wght@400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
