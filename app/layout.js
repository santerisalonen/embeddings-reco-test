import '@mantine/core/styles.css';
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';

export const metadata = {
  title: 'Style Discovery - Mantine',
  description: 'AI-powered product recommendations with Mantine UI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  );
}
