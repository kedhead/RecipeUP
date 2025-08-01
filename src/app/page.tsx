import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Navbar } from '../../components/navigation/navbar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            RecipeUp <span className="text-brand-600">v2</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Modern recipe management and family meal planning platform
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/register">
              <Button size="lg">
                Get Started Free
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mt-16">
            <div className="bg-white rounded-lg p-8 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">✅ Backend Complete</h2>
              <ul className="text-left space-y-2 text-gray-600">
                <li>✅ Modern Next.js 14 + TypeScript</li>
                <li>✅ Drizzle ORM + PostgreSQL</li>
                <li>✅ JWT Authentication System</li>
                <li>✅ Complete Recipe API (28 endpoints)</li>
                <li>✅ Spoonacular Integration</li>
                <li>✅ Family Groups & Meal Planning</li>
                <li>✅ User Reviews & Favorites</li>
                <li>✅ Database Migrations Ready</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-8 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">✅ Frontend Complete</h2>
              <ul className="text-left space-y-2 text-gray-600">
                <li>✅ Modern React Components</li>
                <li>✅ Authentication Pages</li>
                <li>✅ Dashboard Layout</li>
                <li>✅ Navigation System</li>
                <li>✅ Form Components</li>
                <li>✅ Mobile-First Design</li>
                <li>✅ TypeScript Throughout</li>
                <li>✅ Tailwind CSS Styling</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 p-6 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              🎉 Ready for Production
            </h3>
            <p className="text-green-700 text-sm">
              Complete full-stack application with authentication, dashboard, and modern UI components.
              <br />
              <strong>Ready to deploy:</strong> Backend + Frontend implementation complete!
            </p>
          </div>
          
          <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              📚 Deployment Instructions
            </h3>
            <p className="text-blue-700 text-sm">
              See <code className="bg-blue-100 px-2 py-1 rounded">DEPLOYMENT.md</code> for step-by-step setup instructions.
              <br />
              Or check <code className="bg-blue-100 px-2 py-1 rounded">/api/setup/database</code> endpoint for easy database initialization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}