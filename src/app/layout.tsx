
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Use Inter font as specified
import './globals.css';
import Providers from '@/components/Providers'; // Import the Providers component
import MainLayout from '@/components/layout/MainLayout'; // Import the new MainLayout

const inter = Inter({
  variable: '--font-inter', // Define CSS variable if needed
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AnonyCollab',
  description: 'B2B Anonymous Collaboration Platform',
  icons: {
    icon: '/favicon.ico', // Ensure favicon is referenced correctly if it exists
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Wrap children with the client-side Providers component */}
        <Providers>
           {/* Wrap the main content with MainLayout */}
           <MainLayout>
             {children}
           </MainLayout>
        </Providers>
      </body>
    </html>
  );
}
