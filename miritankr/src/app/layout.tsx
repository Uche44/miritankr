import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";



export const metadata: Metadata = {
  title: "MiriTankr",
  description: "Water, just the way you need it",
};
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} h-full antialiased`}
    >
      <body className={`${bricolageGrotesque.className} min-h-full flex flex-col`}>{children}</body>
    </html>
  );
}
