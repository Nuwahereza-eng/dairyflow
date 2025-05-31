
import { Inter } from "next/font/google";
import { NextIntlClientProvider, useMessages, unstable_setRequestLocale } from 'next-intl';
import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext'; // Corrected path

const inter = Inter({ subsets: ["latin"] });

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: {
    locale: string;
  };
}

export const metadata: Metadata = {
  title: 'DairyFlow - MCC & Dairy Farmer Management System',
  description: 'Streamlining dairy operations across Uganda',
};

export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  // Ensure the locale is set for the request context
  // This is crucial for next-intl to work correctly with dynamic rendering and headers()
  unstable_setRequestLocale(params.locale);

  const messages = useMessages();

  return (
    <html lang={params.locale} suppressHydrationWarning>
      <body className={`${inter.className} font-sans antialiased`}>
        <NextIntlClientProvider locale={params.locale} messages={messages}>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
