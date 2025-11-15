import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Research Mentor - AI-Powered Paper Understanding",
  description: "Upload research papers, visualize concepts, and learn with AI tutoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}