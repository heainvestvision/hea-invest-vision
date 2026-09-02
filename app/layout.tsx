import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HEA Invest Vision",
  description: "Club d'investissement — Console de gestion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
