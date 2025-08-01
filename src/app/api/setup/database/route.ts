import { NextRequest, NextResponse } from 'next/server';
import { db, healthCheck } from '../../../../lib/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// POST /api/setup/database - One-time database setup
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Security: Only allow in development or with special header
    if (process.env.NODE_ENV === 'production') {
      const setupKey = request.headers.get('x-setup-key');
      if (setupKey !== process.env.SETUP_KEY) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Check database connection
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Check if setup has already been done
    try {
      const result = await db.execute(sql`SELECT COUNT(*) FROM users LIMIT 1`);
      if (result.length > 0) {
        return NextResponse.json({
          message: 'Database appears to already be set up',
          status: 'already_initialized',
        });
      }
    } catch (error) {
      // Tables don't exist yet, continue with setup
      console.log('Tables not found, proceeding with setup...');
    }

    // Read and execute migration file
    try {
      const migrationPath = join(process.cwd(), 'src', 'lib', 'db', 'migrations', '0000_steady_nomad.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      // Split SQL statements and execute them
      const statements = migrationSQL
        .split('--> statement-breakpoint')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        if (statement) {
          await db.execute(sql.raw(statement));
        }
      }

      return NextResponse.json({
        message: 'Database setup completed successfully',
        status: 'initialized',
        tables_created: [
          'users',
          'family_groups', 
          'family_group_members',
          'recipes',
          'recipe_favorites',
          'recipe_collections',
          'recipe_collection_items', 
          'recipe_reviews',
          'meal_plans',
          'grocery_lists',
          'recipe_search_cache'
        ],
      });
    } catch (migrationError) {
      console.error('Migration error:', migrationError);
      return NextResponse.json(
        { 
          error: 'Failed to run database migrations',
          details: migrationError instanceof Error ? migrationError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { 
        error: 'Database setup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/setup/database - Check database status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Check database connection
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          message: 'Database connection failed' 
        },
        { status: 500 }
      );
    }

    // Check if tables exist
    try {
      const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const recipeCount = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
      const familyGroupCount = await db.execute(sql`SELECT COUNT(*) as count FROM family_groups`);

      return NextResponse.json({
        status: 'healthy',
        message: 'Database is set up and healthy',
        stats: {
          users: Number(userCount[0]?.count || 0),
          recipes: Number(recipeCount[0]?.count || 0),
          familyGroups: Number(familyGroupCount[0]?.count || 0),
        },
      });
    } catch (error) {
      return NextResponse.json({
        status: 'not_initialized',
        message: 'Database tables do not exist yet',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Database status check error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to check database status',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}