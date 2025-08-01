CREATE TABLE IF NOT EXISTS "family_group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"family_group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member',
	"nickname" text,
	"joined_at" timestamp with time zone DEFAULT now(),
	"invited_by" text,
	CONSTRAINT "unique_family_user" UNIQUE("family_group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "family_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"invite_code" text NOT NULL,
	"created_by" text NOT NULL,
	"settings" jsonb DEFAULT '{"mealPlanVisibility":"family_only","recipeSharing":true,"groceryListSharing":true,"allowMemberInvites":true}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "family_groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grocery_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"family_group_id" text NOT NULL,
	"meal_plan_id" text,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"additional_items" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active',
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meal_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"family_group_id" text NOT NULL,
	"name" text DEFAULT 'Weekly Meal Plan' NOT NULL,
	"created_by" text NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"meals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_collection_items" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_collection_recipe" UNIQUE("collection_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"family_group_id" text,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"family_group_id" text,
	"notes" text,
	"rating" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_user_recipe_favorite" UNIQUE("user_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"family_group_id" text,
	"rating" integer NOT NULL,
	"review" text,
	"made_modifications" boolean DEFAULT false,
	"modifications" text,
	"would_make_again" boolean,
	"difficulty_rating" integer,
	"actual_cook_time" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_user_recipe_review" UNIQUE("recipe_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_search_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"query_hash" text NOT NULL,
	"query_params" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"total_results" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "recipe_search_cache_query_hash_unique" UNIQUE("query_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"summary" text,
	"user_id" text NOT NULL,
	"family_group_id" text,
	"spoonacular_id" integer,
	"source_type" text DEFAULT 'user',
	"source_url" text,
	"prep_time_minutes" integer,
	"cook_time_minutes" integer,
	"ready_in_minutes" integer,
	"servings" integer DEFAULT 4 NOT NULL,
	"image_url" text,
	"media_urls" jsonb DEFAULT '[]'::jsonb,
	"difficulty" text,
	"health_score" integer,
	"price_per_serving" numeric(8, 2),
	"is_vegetarian" boolean DEFAULT false,
	"is_vegan" boolean DEFAULT false,
	"is_gluten_free" boolean DEFAULT false,
	"is_dairy_free" boolean DEFAULT false,
	"is_very_healthy" boolean DEFAULT false,
	"is_cheap" boolean DEFAULT false,
	"is_very_popular" boolean DEFAULT false,
	"is_sustainable" boolean DEFAULT false,
	"weight_watcher_smart_points" integer,
	"gaps" text,
	"fodmap_friendly" boolean DEFAULT false,
	"ketogenic" boolean DEFAULT false,
	"whole30" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"dish_types" jsonb DEFAULT '[]'::jsonb,
	"diets" jsonb DEFAULT '[]'::jsonb,
	"occasions" jsonb DEFAULT '[]'::jsonb,
	"cuisine" text,
	"ingredients" jsonb NOT NULL,
	"instructions" jsonb DEFAULT '[]'::jsonb,
	"equipment" jsonb DEFAULT '[]'::jsonb,
	"wine_pairing" jsonb,
	"taste" jsonb,
	"nutrition" jsonb,
	"visibility" text DEFAULT 'private',
	"status" text DEFAULT 'draft',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "recipes_spoonacular_id_unique" UNIQUE("spoonacular_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"password_hash" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"two_factor_enabled" boolean DEFAULT false,
	"subscription_tier" text DEFAULT 'FREE',
	"role" text DEFAULT 'USER',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_group_members" ADD CONSTRAINT "family_group_members_family_group_id_family_groups_id_fk" FOREIGN KEY ("family_group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_group_members" ADD CONSTRAINT "family_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_group_members" ADD CONSTRAINT "family_group_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_groups" ADD CONSTRAINT "family_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_family_group_id_family_groups_id_fk" FOREIGN KEY ("family_group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_family_group_id_family_groups_id_fk" FOREIGN KEY ("family_group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_collection_items" ADD CONSTRAINT "recipe_collection_items_collection_id_recipe_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."recipe_collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_collection_items" ADD CONSTRAINT "recipe_collection_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_family_group_id_family_groups_id_fk" FOREIGN KEY ("family_group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_favorites" ADD CONSTRAINT "recipe_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_favorites" ADD CONSTRAINT "recipe_favorites_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_favorites" ADD CONSTRAINT "recipe_favorites_family_group_id_family_groups_id_fk" FOREIGN KEY ("family_group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_family_group_id_family_groups_id_fk" FOREIGN KEY ("family_group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipes" ADD CONSTRAINT "recipes_family_group_id_family_groups_id_fk" FOREIGN KEY ("family_group_id") REFERENCES "public"."family_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_family_group_members_family_id" ON "family_group_members" USING btree ("family_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_family_group_members_user_id" ON "family_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_family_groups_invite_code" ON "family_groups" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_family_groups_created_by" ON "family_groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grocery_lists_family_group" ON "grocery_lists" USING btree ("family_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grocery_lists_meal_plan" ON "grocery_lists" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grocery_lists_created_by" ON "grocery_lists" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grocery_lists_status" ON "grocery_lists" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_plans_family_group" ON "meal_plans" USING btree ("family_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_plans_created_by" ON "meal_plans" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_plans_week_start" ON "meal_plans" USING btree ("week_start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_plans_active" ON "meal_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_collection_items_collection" ON "recipe_collection_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_collection_items_recipe" ON "recipe_collection_items" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_collections_user" ON "recipe_collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_collections_family" ON "recipe_collections" USING btree ("family_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_favorites_user" ON "recipe_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_favorites_recipe" ON "recipe_favorites" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_favorites_family" ON "recipe_favorites" USING btree ("family_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_reviews_recipe" ON "recipe_reviews" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_reviews_user" ON "recipe_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_reviews_rating" ON "recipe_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_search_cache_query_hash" ON "recipe_search_cache" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_search_cache_expires" ON "recipe_search_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_user_id" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_family_group_id" ON "recipes" USING btree ("family_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_spoonacular_id" ON "recipes" USING btree ("spoonacular_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_source_type" ON "recipes" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_visibility" ON "recipes" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_status" ON "recipes" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_cook_time" ON "recipes" USING btree ("cook_time_minutes");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_health_score" ON "recipes" USING btree ("health_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_dietary" ON "recipes" USING btree ("is_vegetarian","is_vegan","is_gluten_free");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users" USING btree ("username");