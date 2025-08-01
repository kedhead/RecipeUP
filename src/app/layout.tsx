import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RecipeUp v2',
  description: 'Modern recipe management and family meal planning',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}