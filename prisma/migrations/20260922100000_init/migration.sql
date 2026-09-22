CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_name_key" ON "users"("name");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_name_lower_key" ON "users"(LOWER("name"));

CREATE TABLE "nutrition_profiles" (
    "user_id" TEXT NOT NULL,
    "age" DOUBLE PRECISION NOT NULL,
    "sex" TEXT NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "activity_level" TEXT NOT NULL,
    "goal_type" TEXT NOT NULL,
    "target_weight_kg" DOUBLE PRECISION,
    "rate_kg_per_week" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "dietary_preference" TEXT NOT NULL DEFAULT 'none',
    "allergies" TEXT NOT NULL DEFAULT '',
    "disliked_foods" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "food_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "food_name" TEXT NOT NULL,
    "quantity" TEXT,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein_g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs_g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat_g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar_g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium_mg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "eaten_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_logs_user_id_eaten_at_idx" ON "food_logs"("user_id", "eaten_at");

CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "weight_logs_user_id_measured_at_idx" ON "weight_logs"("user_id", "measured_at");

CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_activity_id" TEXT,
    "activity_type" TEXT NOT NULL,
    "activity_name" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_seconds" INTEGER,
    "distance_meters" DOUBLE PRECISION,
    "estimated_energy_kcal" DOUBLE PRECISION,
    "energy_source" TEXT,
    "data_quality" TEXT NOT NULL,
    "raw_provider_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "activity_logs_user_id_provider_provider_activity_id_key" ON "activity_logs"("user_id", "provider", "provider_activity_id");

CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein_g" DOUBLE PRECISION NOT NULL,
    "carbs_g" DOUBLE PRECISION NOT NULL,
    "fat_g" DOUBLE PRECISION NOT NULL,
    "allergens_json" JSONB NOT NULL,
    "dietary_tags_json" JSONB NOT NULL,
    "inventory_available" INTEGER NOT NULL,
    "serving_size" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "adaptive_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_date" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "base_daily_calorie_target" DOUBLE PRECISION NOT NULL,
    "effective_daily_calorie_target" DOUBLE PRECISION NOT NULL,
    "catering_calorie_allocation" DOUBLE PRECISION NOT NULL,
    "protein_target_g" DOUBLE PRECISION NOT NULL,
    "carbs_target_g" DOUBLE PRECISION NOT NULL,
    "fat_target_g" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "state_version" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "explanation_codes_json" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "input_snapshot_json" JSONB NOT NULL,
    CONSTRAINT "adaptive_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adaptive_plans_user_id_plan_date_key" ON "adaptive_plans"("user_id", "plan_date");

CREATE TABLE "catering_meals" (
    "id" TEXT NOT NULL,
    "adaptive_plan_id" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "menu_id" TEXT,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein_g" DOUBLE PRECISION NOT NULL,
    "carbs_g" DOUBLE PRECISION NOT NULL,
    "fat_g" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "catering_meals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telegram_connections" (
    "user_id" TEXT NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_connections_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "telegram_connections_telegram_user_id_key" ON "telegram_connections"("telegram_user_id");

CREATE TABLE "telegram_bind_tokens" (
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_bind_tokens_pkey" PRIMARY KEY ("token_hash")
);

CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "actor_user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "detail_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

ALTER TABLE "nutrition_profiles" ADD CONSTRAINT "nutrition_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adaptive_plans" ADD CONSTRAINT "adaptive_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catering_meals" ADD CONSTRAINT "catering_meals_adaptive_plan_id_fkey" FOREIGN KEY ("adaptive_plan_id") REFERENCES "adaptive_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catering_meals" ADD CONSTRAINT "catering_meals_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "telegram_connections" ADD CONSTRAINT "telegram_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telegram_bind_tokens" ADD CONSTRAINT "telegram_bind_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
