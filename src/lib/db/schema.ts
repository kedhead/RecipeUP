import { pgTable, text, integer, decimal, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

// ============================================================================
// Helper Functions
// ============================================================================

function createId() {
  return nanoid();
}

// ============================================================================
// Core User Management
// ============================================================================

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').default(false),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  subscriptionTier: text('subscription_tier', { enum: ['FREE', 'PREMIUM', 'FAMILY'] }).default('FREE'),
  role: text('role', { enum: ['USER', 'ADMIN'] }).default('USER'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  usernameIdx: index('idx_users_username').on(table.username),
}));

// ============================================================================
// Family Groups
// ============================================================================

export const familyGroups = pgTable('family_groups', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<{
    mealPlanVisibility: 'family_only' | 'public';
    recipeSharing: boolean;
    groceryListSharing: boolean;
    allowMemberInvites: boolean;
  }>().default({
    mealPlanVisibility: 'family_only',
    recipeSharing: true,
    groceryListSharing: true,
    allowMemberInvites: true,
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  inviteCodeIdx: index('idx_family_groups_invite_code').on(table.inviteCode),
  createdByIdx: index('idx_family_groups_created_by').on(table.createdBy),
}));

export const familyGroupMembers = pgTable('family_group_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  familyGroupId: text('family_group_id').notNull().references(() => familyGroups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'member'] }).default('member'),
  nickname: text('nickname'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  invitedBy: text('invited_by').references(() => users.id),
}, (table) => ({
  familyGroupIdx: index('idx_family_group_members_family_id').on(table.familyGroupId),
  userIdx: index('idx_family_group_members_user_id').on(table.userId),
  uniqueMembership: unique('unique_family_user').on(table.familyGroupId, table.userId),
}));

// ============================================================================
// Recipe Management
// ============================================================================

export const recipes = pgTable('recipes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  description: text('description'),
  summary: text('summary'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyGroupId: text('family_group_id').references(() => familyGroups.id, { onDelete: 'cascade' }),
  
  // Source tracking
  spoonacularId: integer('spoonacular_id').unique(),
  sourceType: text('source_type', { enum: ['user', 'spoonacular', 'scraped'] }).default('user'),
  sourceUrl: text('source_url'),
  
  // Timing and serving info
  prepTimeMinutes: integer('prep_time_minutes'),
  cookTimeMinutes: integer('cook_time_minutes'),
  readyInMinutes: integer('ready_in_minutes'),
  servings: integer('servings').notNull().default(4),
  
  // Media and presentation
  imageUrl: text('image_url'),
  mediaUrls: jsonb('media_urls').$type<string[]>().default([]),
  
  // Difficulty and health metrics
  difficulty: text('difficulty', { enum: ['EASY', 'MEDIUM', 'HARD'] }),
  healthScore: integer('health_score'), // 0-100
  pricePerServing: decimal('price_per_serving', { precision: 8, scale: 2 }),
  
  // Dietary and health flags
  isVegetarian: boolean('is_vegetarian').default(false),
  isVegan: boolean('is_vegan').default(false),
  isGlutenFree: boolean('is_gluten_free').default(false),
  isDairyFree: boolean('is_dairy_free').default(false),
  isVeryHealthy: boolean('is_very_healthy').default(false),
  isCheap: boolean('is_cheap').default(false),
  isVeryPopular: boolean('is_very_popular').default(false),
  isSustainable: boolean('is_sustainable').default(false),
  
  // Special diet compatibility
  weightWatcherSmartPoints: integer('weight_watcher_smart_points'),
  gaps: text('gaps', { 
    enum: ['yes', 'no', 'GAPS_1', 'GAPS_2', 'GAPS_3', 'GAPS_4', 'GAPS_5', 'GAPS_6'] 
  }),
  fodmapFriendly: boolean('fodmap_friendly').default(false),
  ketogenic: boolean('ketogenic').default(false),
  whole30: boolean('whole30').default(false),
  
  // Categorization
  tags: jsonb('tags').$type<string[]>().default([]),
  dishTypes: jsonb('dish_types').$type<string[]>().default([]),
  diets: jsonb('diets').$type<string[]>().default([]),
  occasions: jsonb('occasions').$type<string[]>().default([]),
  cuisine: text('cuisine'),
  
  // Recipe content
  ingredients: jsonb('ingredients').$type<{
    name: string;
    amount: string;
    unit: string;
    notes?: string;
    category?: string;
  }[]>().notNull(),
  instructions: jsonb('instructions').$type<{
    step: number;
    instruction: string;
    time?: number;
    temperature?: { value: number; unit: 'F' | 'C' };
  }[]>().default([]),
  equipment: jsonb('equipment').$type<{
    name: string;
    imageUrl?: string;
    spoonacularId?: number;
  }[]>().default([]),
  
  // Additional data
  winePairing: jsonb('wine_pairing').$type<{
    pairedWines?: string[];
    pairingText?: string;
    productMatches?: any[];
  }>(),
  taste: jsonb('taste').$type<{
    sweetness: number;
    saltiness: number;
    sourness: number;
    bitterness: number;
    savoriness: number;
    fattiness: number;
    spiciness: number;
  }>(),
  nutrition: jsonb('nutrition').$type<{
    calories?: number;
    fat?: number;
    saturatedFat?: number;
    carbohydrates?: number;
    netCarbohydrates?: number;
    sugar?: number;
    cholesterol?: number;
    sodium?: number;
    protein?: number;
    fiber?: number;
    [key: string]: number | undefined;
  }>(),
  
  // Visibility and status
  visibility: text('visibility', { enum: ['public', 'family', 'private'] }).default('private'),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).default('draft'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('idx_recipes_user_id').on(table.userId),
  familyGroupIdx: index('idx_recipes_family_group_id').on(table.familyGroupId),
  spoonacularIdx: index('idx_recipes_spoonacular_id').on(table.spoonacularId),
  sourceTypeIdx: index('idx_recipes_source_type').on(table.sourceType),
  visibilityIdx: index('idx_recipes_visibility').on(table.visibility),
  statusIdx: index('idx_recipes_status').on(table.status),
  cookTimeIdx: index('idx_recipes_cook_time').on(table.cookTimeMinutes),
  healthScoreIdx: index('idx_recipes_health_score').on(table.healthScore),
  dietaryIdx: index('idx_recipes_dietary').on(table.isVegetarian, table.isVegan, table.isGlutenFree),
}));

// ============================================================================
// Recipe User Interactions
// ============================================================================

export const recipeFavorites = pgTable('recipe_favorites', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  familyGroupId: text('family_group_id').references(() => familyGroups.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  rating: integer('rating'), // 1-5
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('idx_recipe_favorites_user').on(table.userId),
  recipeIdx: index('idx_recipe_favorites_recipe').on(table.recipeId),
  familyIdx: index('idx_recipe_favorites_family').on(table.familyGroupId),
  uniqueFavorite: unique('unique_user_recipe_favorite').on(table.userId, table.recipeId),
}));

export const recipeCollections = pgTable('recipe_collections', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyGroupId: text('family_group_id').references(() => familyGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('idx_recipe_collections_user').on(table.userId),
  familyIdx: index('idx_recipe_collections_family').on(table.familyGroupId),
}));

export const recipeCollectionItems = pgTable('recipe_collection_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  collectionId: text('collection_id').notNull().references(() => recipeCollections.id, { onDelete: 'cascade' }),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  collectionIdx: index('idx_recipe_collection_items_collection').on(table.collectionId),
  recipeIdx: index('idx_recipe_collection_items_recipe').on(table.recipeId),
  uniqueItem: unique('unique_collection_recipe').on(table.collectionId, table.recipeId),
}));

export const recipeReviews = pgTable('recipe_reviews', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyGroupId: text('family_group_id').references(() => familyGroups.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(), // 1-5
  review: text('review'),
  madeModifications: boolean('made_modifications').default(false),
  modifications: text('modifications'),
  wouldMakeAgain: boolean('would_make_again'),
  difficultyRating: integer('difficulty_rating'), // 1-5
  actualCookTime: integer('actual_cook_time'), // minutes
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  recipeIdx: index('idx_recipe_reviews_recipe').on(table.recipeId),
  userIdx: index('idx_recipe_reviews_user').on(table.userId),
  ratingIdx: index('idx_recipe_reviews_rating').on(table.rating),
  uniqueReview: unique('unique_user_recipe_review').on(table.recipeId, table.userId),
}));

// ============================================================================
// Meal Planning
// ============================================================================

export const mealPlans = pgTable('meal_plans', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  familyGroupId: text('family_group_id').notNull().references(() => familyGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Weekly Meal Plan'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStartDate: text('week_start_date').notNull(), // YYYY-MM-DD format
  weekEndDate: text('week_end_date').notNull(),
  meals: jsonb('meals').$type<{
    [day: string]: {
      [mealType: string]: {
        recipeId?: string;
        recipeName?: string;
        notes?: string;
        servings?: number;
      };
    };
  }>().notNull().default({}),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  familyGroupIdx: index('idx_meal_plans_family_group').on(table.familyGroupId),
  createdByIdx: index('idx_meal_plans_created_by').on(table.createdBy),
  weekStartIdx: index('idx_meal_plans_week_start').on(table.weekStartDate),
  activeIdx: index('idx_meal_plans_active').on(table.isActive),
}));

// ============================================================================
// Grocery Lists
// ============================================================================

export const groceryLists = pgTable('grocery_lists', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  familyGroupId: text('family_group_id').notNull().references(() => familyGroups.id, { onDelete: 'cascade' }),
  mealPlanId: text('meal_plan_id').references(() => mealPlans.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ingredients: jsonb('ingredients').$type<{
    name: string;
    amount: string;
    unit: string;
    category: string;
    checked: boolean;
    recipeSources?: string[];
    notes?: string;
  }[]>().notNull().default([]),
  additionalItems: jsonb('additional_items').$type<{
    name: string;
    category: string;
    checked: boolean;
    notes?: string;
  }[]>().default([]),
  status: text('status', { enum: ['active', 'completed', 'archived'] }).default('active'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  familyGroupIdx: index('idx_grocery_lists_family_group').on(table.familyGroupId),
  mealPlanIdx: index('idx_grocery_lists_meal_plan').on(table.mealPlanId),
  createdByIdx: index('idx_grocery_lists_created_by').on(table.createdBy),
  statusIdx: index('idx_grocery_lists_status').on(table.status),
}));

// ============================================================================
// Search and Caching
// ============================================================================

export const recipeSearchCache = pgTable('recipe_search_cache', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  queryHash: text('query_hash').notNull().unique(),
  queryParams: jsonb('query_params').notNull(),
  results: jsonb('results').notNull(),
  totalResults: integer('total_results'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  queryHashIdx: index('idx_recipe_search_cache_query_hash').on(table.queryHash),
  expiresAtIdx: index('idx_recipe_search_cache_expires').on(table.expiresAt),
}));

// ============================================================================
// Export Types
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type FamilyGroup = typeof familyGroups.$inferSelect;
export type NewFamilyGroup = typeof familyGroups.$inferInsert;

export type FamilyGroupMember = typeof familyGroupMembers.$inferSelect;
export type NewFamilyGroupMember = typeof familyGroupMembers.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export type RecipeFavorite = typeof recipeFavorites.$inferSelect;
export type NewRecipeFavorite = typeof recipeFavorites.$inferInsert;

export type RecipeCollection = typeof recipeCollections.$inferSelect;
export type NewRecipeCollection = typeof recipeCollections.$inferInsert;

export type RecipeReview = typeof recipeReviews.$inferSelect;
export type NewRecipeReview = typeof recipeReviews.$inferInsert;

export type MealPlan = typeof mealPlans.$inferSelect;
export type NewMealPlan = typeof mealPlans.$inferInsert;

export type GroceryList = typeof groceryLists.$inferSelect;
export type NewGroceryList = typeof groceryLists.$inferInsert;