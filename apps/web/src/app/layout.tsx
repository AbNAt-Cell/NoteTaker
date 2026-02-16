import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoteTaker — AI-Powered Note Taking & Meeting Intelligence',
  description: 'Capture, organize, and supercharge your notes with AI. Meeting transcription, smart summaries, and real-time collaboration.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
