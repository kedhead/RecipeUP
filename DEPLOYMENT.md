# 🚀 RecipeUp v2 Deployment Guide

## Prerequisites

- GitHub account (already set up)
- Vercel account
- Supabase account
- Spoonacular API key (optional)

## Step 1: Set up Supabase Database

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Choose a database password
   - Wait for project to be ready

2. **Get Database URL**
   - Go to Settings → Database
   - Copy the connection string (URI format)
   - Replace `[YOUR-PASSWORD]` with your actual password

3. **Set up Database Schema**
   ```bash
   # Set your DATABASE_URL in .env.local
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   
   # Generate and run migrations
   npm run db:generate
   npm run db:migrate
   ```

## Step 2: Deploy to Vercel

1. **Connect GitHub Repository**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository: `https://github.com/kedhead/RecipeUP`
   - Choose the main branch

2. **Configure Environment Variables**
   Add these environment variables in Vercel dashboard:

   ```bash
   # Database (Required)
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   
   # Authentication (Required)
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
   
   # App Configuration (Required)
   NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app
   NODE_ENV=production
   
   # Spoonacular API (Optional - for external recipes)
   SPOONACULAR_API_KEY=your-spoonacular-api-key
   ```

3. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Visit your app URL

## Step 3: Initialize Database

Once deployed, you can initialize your database in several ways:

### Option A: Using Supabase SQL Editor
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the generated SQL from `src/lib/db/migrations/` and run it

### Option B: Using Local Migration (Recommended)
```bash
# With your production DATABASE_URL in .env.local
npm run db:migrate
```

### Option C: Using API Route (Coming Soon)
We can create a one-time setup endpoint for easier initialization.

## Step 4: Test Your Deployment

1. **Visit your app**: `https://your-app-name.vercel.app`
2. **Test API endpoints**: 
   - `GET /api/auth/me` (should return 401)
   - `POST /api/auth/register` (create test user)
   - `POST /api/auth/login` (test login)

## Step 5: Optional Enhancements

### Custom Domain
- Add custom domain in Vercel dashboard
- Configure DNS records

### Monitoring
- Vercel provides built-in analytics
- Supabase provides database monitoring

### Performance
- Enable Vercel Edge Functions for auth endpoints
- Configure caching headers

## Environment Variables Reference

### Required Variables
```bash
DATABASE_URL=               # Supabase PostgreSQL connection string
JWT_SECRET=                 # Random string (min 32 characters)
NEXT_PUBLIC_APP_URL=        # Your deployed app URL
NODE_ENV=production         # Set to production
```

### Optional Variables
```bash
SPOONACULAR_API_KEY=        # For external recipe search
```

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL format
- Check Supabase project status
- Ensure IP restrictions are disabled (or whitelist Vercel IPs)

### Build Failures
- Check TypeScript errors in Vercel logs
- Verify all environment variables are set
- Check for missing dependencies

### API Errors
- Check Vercel function logs
- Verify JWT_SECRET is set correctly
- Test database connectivity

## Security Checklist

- ✅ JWT_SECRET is strong and unique
- ✅ Database has proper SSL configuration
- ✅ Environment variables are not exposed to client
- ✅ CORS is properly configured
- ✅ Rate limiting is in place (built into APIs)

## Next Steps

Once deployed:
1. Create your first user account
2. Test recipe creation and search
3. Create a family group
4. Set up meal planning
5. Start building the frontend UI

---

**Your RecipeUp v2 backend is now live and ready for frontend development!** 🎉