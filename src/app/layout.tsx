import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "News in Tavola | Food Hub",
  description: "Le notizie più interessanti dal mondo nel settore agroalimentare.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full">
      <body className={`${poppins.className} h-full antialiased`}>
        {children}
      </body>
    </html>
  );
}
