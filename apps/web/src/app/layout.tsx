import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoteTaker — AI-Powered Note Taking & Meeting Intelligence',
  description: 'Capture, organize, and supercharge your notes with AI. Meeting transcription, smart summaries, and real-time collaboration.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>',
  },
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
