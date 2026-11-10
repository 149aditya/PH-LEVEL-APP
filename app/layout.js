import './globals.css';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'pH Scan';

export const metadata = {
  title: `${BRAND}: food pH from a photo`,
  description: 'Photograph a dish to see what it is and its typical pH range.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#eef3f0',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
