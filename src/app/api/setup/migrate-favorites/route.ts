import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { sql } from 'drizzle-orm';

export async function POST() {
  try {
    console.log('Starting favorites table migration...');
    
    // First, check if the constraint exists
    const constraintCheck = await db.execute(sql`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'recipe_favorites_recipe_id_recipes_id_fk'
    `);
    
    if (constraintCheck.length > 0) {
      console.log('Dropping foreign key constraint...');
      await db.execute(sql`
        ALTER TABLE recipe_favorites 
        DROP CONSTRAINT IF EXISTS recipe_favorites_recipe_id_recipes_id_fk
      `);
      console.log('Foreign key constraint dropped successfully');
    } else {
      console.log('Foreign key constraint does not exist, skipping drop');
    }
    
    // Verify the constraint was removed
    const verifyCheck = await db.execute(sql`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'recipe_favorites_recipe_id_recipes_id_fk'
    `);
    
    if (verifyCheck.length === 0) {
      console.log('Migration completed successfully');
      return NextResponse.json({ 
        success: true, 
        message: 'Favorites table migration completed successfully',
        details: 'Foreign key constraint removed to support external recipe favorites'
      });
    } else {
      console.error('Migration failed - constraint still exists');
      return NextResponse.json({ 
        success: false, 
        error: 'Migration verification failed - constraint still exists'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}