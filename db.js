const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const now = () => new Date().toISOString();
const json = value => JSON.stringify(value ?? []);
const parse = (value, fallback = []) => { try { return JSON.parse(value); } catch { return fallback; } };

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(password), salt, 64).toString('hex')}`;
}

function verifyPassword(password, encoded) {
  const [scheme, salt, expected] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}

function createDatabase(dataDir, configuredUsers = []) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'calora.sqlite'));
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, email TEXT UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('USER','ADMIN')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nutrition_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, age REAL NOT NULL, sex TEXT NOT NULL,
      height_cm REAL NOT NULL, weight_kg REAL NOT NULL, activity_level TEXT NOT NULL, goal_type TEXT NOT NULL,
      target_weight_kg REAL, rate_kg_per_week REAL NOT NULL DEFAULT 0.25,
      dietary_preference TEXT NOT NULL DEFAULT 'none', allergies TEXT NOT NULL DEFAULT '', disliked_foods TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok', version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS food_logs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, meal_type TEXT NOT NULL,
      food_name TEXT NOT NULL, quantity TEXT, calories REAL NOT NULL CHECK(calories >= 0), protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0, fat_g REAL NOT NULL DEFAULT 0, sugar_g REAL NOT NULL DEFAULT 0,
      sodium_mg REAL NOT NULL DEFAULT 0, source TEXT NOT NULL, confidence REAL, eaten_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS food_logs_user_eaten ON food_logs(user_id, eaten_at);
    CREATE TABLE IF NOT EXISTS weight_logs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, weight_kg REAL NOT NULL,
      measured_at TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS weight_logs_user_measured ON weight_logs(user_id, measured_at);
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL,
      provider_activity_id TEXT, activity_type TEXT NOT NULL, activity_name TEXT, started_at TEXT NOT NULL,
      duration_seconds INTEGER, distance_meters REAL, estimated_energy_kcal REAL, energy_source TEXT,
      data_quality TEXT NOT NULL, raw_provider_reference TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, provider, provider_activity_id)
    );
    CREATE TABLE IF NOT EXISTS menus (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, meal_type TEXT NOT NULL CHECK(meal_type IN ('LUNCH','DINNER')),
      calories REAL NOT NULL, protein_g REAL NOT NULL, carbs_g REAL NOT NULL, fat_g REAL NOT NULL,
      allergens_json TEXT NOT NULL, dietary_tags_json TEXT NOT NULL, inventory_available INTEGER NOT NULL,
      serving_size TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS adaptive_plans (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, plan_date TEXT NOT NULL,
      generated_at TEXT NOT NULL, base_daily_calorie_target REAL NOT NULL, effective_daily_calorie_target REAL NOT NULL,
      catering_calorie_allocation REAL NOT NULL, protein_target_g REAL NOT NULL, carbs_target_g REAL NOT NULL,
      fat_target_g REAL NOT NULL, confidence TEXT NOT NULL, state_version TEXT NOT NULL, engine_version TEXT NOT NULL,
      explanation_codes_json TEXT NOT NULL, status TEXT NOT NULL, input_snapshot_json TEXT NOT NULL,
      UNIQUE(user_id, plan_date)
    );
    CREATE TABLE IF NOT EXISTS catering_meals (
      id TEXT PRIMARY KEY, adaptive_plan_id TEXT NOT NULL REFERENCES adaptive_plans(id) ON DELETE CASCADE,
      meal_type TEXT NOT NULL, menu_id TEXT REFERENCES menus(id), calories REAL NOT NULL, protein_g REAL NOT NULL,
      carbs_g REAL NOT NULL, fat_g REAL NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_connections (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, telegram_user_id TEXT NOT NULL UNIQUE,
      connected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_bind_tokens (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY, user_id TEXT, actor_user_id TEXT, event_type TEXT NOT NULL,
      entity_type TEXT, entity_id TEXT, detail_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(1, now());

  const insertUser = db.prepare('INSERT OR IGNORE INTO users(id,name,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
  const insertProfile = db.prepare(`INSERT OR IGNORE INTO nutrition_profiles(
    user_id,age,sex,height_cm,weight_kg,activity_level,goal_type,target_weight_kg,rate_kg_per_week,dietary_preference,allergies,disliked_foods,timezone,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const user of configuredUsers) {
    const timestamp = now();
    insertUser.run(user.id, user.name, user.email || null, user.passwordHash || hashPassword(user.password), user.role || 'USER', timestamp, timestamp);
    const p = user.profile || {};
    insertProfile.run(user.id, p.age || 25, p.sex || 'male', p.tb || p.heightCm || 171, p.bb || p.weightKg || 65,
      p.activity || 'moderate', p.goal || 'maintain', p.targetWeightKg || p.bb || 65, p.rateKgPerWeek || 0.25,
      p.dietaryPreference || 'none', p.allergies || '', p.dislikedFoods || '', p.timezone || 'Asia/Bangkok', timestamp);
  }

  const menuCount = db.prepare('SELECT COUNT(*) count FROM menus').get().count;
  if (!menuCount) {
    const insertMenu = db.prepare('INSERT INTO menus VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    [
      ['P04','Ayam panggang, nasi, dan sayur','LUNCH',620,48,70,16,[],['none'],'180 g protein + sides'],
      ['P07','Tempe, nasi merah, dan sayur','LUNCH',590,35,78,16,['soy'],['vegetarian','vegan'],'1 serving'],
      ['P09','Ikan panggang dan sayur','LUNCH',570,46,50,20,['fish'],['pescatarian'],'1 serving'],
      ['P11','Ayam lada hitam dan kentang','DINNER',680,53,68,22,[],['none'],'1 serving'],
      ['P13','Tofu teriyaki dan edamame','DINNER',640,39,72,20,['soy'],['vegetarian','vegan'],'1 serving'],
      ['P15','Salmon, kentang, dan salad','DINNER',700,50,58,27,['fish'],['pescatarian'],'1 serving']
    ].forEach(item => insertMenu.run(item[0],item[1],item[2],item[3],item[4],item[5],item[6],json(item[7]),json(item[8]),50,item[9],1));
  }
  return db;
}

function createStore(dataDir, configuredUsers) {
  const db = createDatabase(dataDir, configuredUsers);
  const profileFor = row => row && ({ bb: row.weight_kg, tb: row.height_cm, age: row.age, sex: row.sex, activity: row.activity_level,
    goal: row.goal_type, targetWeightKg: row.target_weight_kg, rateKgPerWeek: row.rate_kg_per_week,
    dietaryPreference: row.dietary_preference, allergies: row.allergies, dislikedFoods: row.disliked_foods, timezone: row.timezone, version: row.version });
  const foodFor = row => ({ id: row.id, meal: row.food_name, category: row.meal_type.toLowerCase(), kcal: row.calories,
    protein: row.protein_g, carbs: row.carbs_g, fat: row.fat_g, sugar: row.sugar_g, sodium: row.sodium_mg,
    source: row.source, confidence: row.confidence, createdAt: row.eaten_at });
  const activityFor = row => ({ id: row.id, provider: row.provider, providerActivityId: row.provider_activity_id,
    activityType: row.activity_type, name: row.activity_name, startedAt: row.started_at, durationSeconds: row.duration_seconds,
    duration: row.duration_seconds == null ? null : Math.round(row.duration_seconds / 60), distanceMeters: row.distance_meters,
    distance: row.distance_meters == null ? null : Number((row.distance_meters / 1000).toFixed(2)),
    estimatedEnergyKcal: row.estimated_energy_kcal, calories: row.estimated_energy_kcal, energySource: row.energy_source,
    dataQuality: row.data_quality, source: row.provider, timestamp: new Date(row.started_at).getTime(), date: new Date(row.started_at).toDateString() });

  return {
    db, verifyPassword,
    listUsers() { return db.prepare('SELECT id,name,email,role FROM users ORDER BY name').all(); },
    findUserByName(name) { return db.prepare('SELECT * FROM users WHERE name = ? COLLATE NOCASE').get(name); },
    findUserById(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(id); },
    publicUser(id) { const user = this.findUserById(id); return user && { id: user.id, name: user.name, email: user.email, role: user.role, profile: this.getProfile(id) }; },
    getProfile(userId) { return profileFor(db.prepare('SELECT * FROM nutrition_profiles WHERE user_id=?').get(userId)); },
    updateProfile(userId, p) {
      db.prepare(`UPDATE nutrition_profiles SET age=?,sex=?,height_cm=?,weight_kg=?,activity_level=?,goal_type=?,target_weight_kg=?,rate_kg_per_week=?,dietary_preference=?,allergies=?,disliked_foods=?,timezone=?,version=version+1,updated_at=? WHERE user_id=?`)
        .run(p.age,p.sex,p.tb,p.bb,p.activity,p.goal,p.targetWeightKg,p.rateKgPerWeek,p.dietaryPreference,p.allergies,p.dislikedFoods,p.timezone || 'Asia/Bangkok',now(),userId);
      return this.getProfile(userId);
    },
    listFood(userId) { return db.prepare('SELECT * FROM food_logs WHERE user_id=? ORDER BY eaten_at').all(userId).map(foodFor); },
    insertFood(userId, f) { db.prepare('INSERT INTO food_logs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(f.id,userId,f.category.toUpperCase(),f.meal,null,f.kcal,f.protein,f.carbs,f.fat,f.sugar,f.sodium,f.source.toUpperCase(),f.confidence,f.createdAt,now()); return f; },
    updateFood(userId, id, f) { const result=db.prepare(`UPDATE food_logs SET meal_type=?,food_name=?,calories=?,protein_g=?,carbs_g=?,fat_g=?,sugar_g=?,sodium_mg=?,source=?,confidence=?,eaten_at=? WHERE id=? AND user_id=?`).run(f.category.toUpperCase(),f.meal,f.kcal,f.protein,f.carbs,f.fat,f.sugar,f.sodium,f.source.toUpperCase(),f.confidence,f.createdAt,id,userId); return result.changes ? foodFor(db.prepare('SELECT * FROM food_logs WHERE id=? AND user_id=?').get(id,userId)) : null; },
    deleteFood(userId,id) { return db.prepare('DELETE FROM food_logs WHERE id=? AND user_id=?').run(id,userId).changes > 0; },
    listWeights(userId) { return db.prepare('SELECT id,weight_kg weightKg,measured_at measuredAt,source,created_at createdAt FROM weight_logs WHERE user_id=? ORDER BY measured_at').all(userId); },
    insertWeight(userId,w) { db.prepare('INSERT INTO weight_logs VALUES (?,?,?,?,?,?)').run(w.id,userId,w.weightKg,w.measuredAt,w.source,now()); return w; },
    deleteWeight(userId,id) { return db.prepare('DELETE FROM weight_logs WHERE id=? AND user_id=?').run(id,userId).changes > 0; },
    listActivities(userId) { return db.prepare('SELECT * FROM activity_logs WHERE user_id=? ORDER BY started_at').all(userId).map(activityFor); },
    insertActivity(userId,a) {
      try { db.prepare('INSERT INTO activity_logs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(a.id,userId,a.provider,a.providerActivityId || null,a.activityType,a.name || null,a.startedAt,a.durationSeconds ?? null,a.distanceMeters ?? null,a.estimatedEnergyKcal ?? null,a.energySource || 'USER_ESTIMATE',a.dataQuality || 'ESTIMATED',a.rawProviderReference || null,now(),now()); }
      catch (error) { if (!String(error.message).includes('UNIQUE')) throw error; }
      return db.prepare('SELECT * FROM activity_logs WHERE user_id=? AND provider=? AND provider_activity_id IS ?').get(userId,a.provider,a.providerActivityId || null);
    },
    deleteActivity(userId,id) { return db.prepare('DELETE FROM activity_logs WHERE id=? AND user_id=?').run(id,userId).changes > 0; },
    listMenus() { return db.prepare('SELECT * FROM menus WHERE active=1').all().map(row => ({ id:row.id,name:row.name,mealType:row.meal_type,calories:row.calories,proteinG:row.protein_g,carbsG:row.carbs_g,fatG:row.fat_g,allergens:parse(row.allergens_json),dietaryTags:parse(row.dietary_tags_json),inventoryAvailable:row.inventory_available,servingSize:row.serving_size,active:Boolean(row.active) })); },
    recentMenuIds(userId) { return db.prepare(`SELECT c.menu_id FROM catering_meals c JOIN adaptive_plans p ON p.id=c.adaptive_plan_id WHERE p.user_id=? AND c.menu_id IS NOT NULL ORDER BY p.plan_date DESC LIMIT 4`).all(userId).map(row=>row.menu_id); },
    getPlan(userId,date) { const row=db.prepare('SELECT * FROM adaptive_plans WHERE user_id=? AND plan_date=?').get(userId,date); if(!row)return null; const meals=db.prepare('SELECT * FROM catering_meals WHERE adaptive_plan_id=?').all(row.id); return { id:row.id,planDate:row.plan_date,generatedAt:row.generated_at,baseDailyTarget:row.base_daily_calorie_target,effectiveDailyTarget:row.effective_daily_calorie_target,cateringAllocation:row.catering_calorie_allocation,proteinTargetG:row.protein_target_g,carbsTargetG:row.carbs_target_g,fatTargetG:row.fat_target_g,confidence:row.confidence,stateVersion:row.state_version,engineVersion:row.engine_version,explanationCodes:parse(row.explanation_codes_json),status:row.status,rollingState:parse(row.input_snapshot_json,{}),lunch:meals.find(m=>m.meal_type==='LUNCH')&&this.menuMeal(meals.find(m=>m.meal_type==='LUNCH')),dinner:meals.find(m=>m.meal_type==='DINNER')&&this.menuMeal(meals.find(m=>m.meal_type==='DINNER'))}; },
    menuMeal(row) { const menu=row.menu_id&&db.prepare('SELECT name FROM menus WHERE id=?').get(row.menu_id); return { id:row.menu_id,name:menu?.name || 'Unassigned',mealType:row.meal_type,calories:row.calories,proteinG:row.protein_g,carbsG:row.carbs_g,fatG:row.fat_g,status:row.status }; },
    savePlan(userId,plan) { const existing=this.getPlan(userId,plan.planDate); if(existing?.status==='LOCKED')return existing; const id=existing?.id || `plan_${crypto.randomUUID()}`; db.exec('BEGIN'); try { db.prepare(`INSERT INTO adaptive_plans VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,plan_date) DO UPDATE SET generated_at=excluded.generated_at,base_daily_calorie_target=excluded.base_daily_calorie_target,effective_daily_calorie_target=excluded.effective_daily_calorie_target,catering_calorie_allocation=excluded.catering_calorie_allocation,protein_target_g=excluded.protein_target_g,carbs_target_g=excluded.carbs_target_g,fat_target_g=excluded.fat_target_g,confidence=excluded.confidence,state_version=excluded.state_version,engine_version=excluded.engine_version,explanation_codes_json=excluded.explanation_codes_json,status=excluded.status,input_snapshot_json=excluded.input_snapshot_json`).run(id,userId,plan.planDate,plan.generatedAt,plan.baseDailyTarget,plan.effectiveDailyTarget,plan.cateringAllocation,plan.proteinTargetG,plan.carbsTargetG,plan.fatTargetG,plan.confidence,plan.stateVersion,plan.engineVersion,json(plan.explanationCodes),plan.status,json(plan.rollingState)); db.prepare('DELETE FROM catering_meals WHERE adaptive_plan_id=?').run(id); const insert=db.prepare('INSERT INTO catering_meals VALUES (?,?,?,?,?,?,?,?,?)'); for(const meal of [plan.lunch,plan.dinner].filter(Boolean))insert.run(`meal_${crypto.randomUUID()}`,id,meal.mealType,meal.id,meal.calories,meal.proteinG,meal.carbsG,meal.fatG,plan.status); db.exec('COMMIT'); } catch(error){db.exec('ROLLBACK');throw error;} return this.getPlan(userId,plan.planDate); },
    setPlanStatus(id,status) { db.prepare('UPDATE adaptive_plans SET status=? WHERE id=?').run(status,id); db.prepare('UPDATE catering_meals SET status=? WHERE adaptive_plan_id=?').run(status,id); },
    adminPlans(date) { return db.prepare(`SELECT p.*,u.name user_name,n.allergies,n.dietary_preference FROM adaptive_plans p JOIN users u ON u.id=p.user_id JOIN nutrition_profiles n ON n.user_id=p.user_id WHERE p.plan_date=? ORDER BY u.name`).all(date).map(row=>({id:row.id,userId:row.user_id,userName:row.user_name,planDate:row.plan_date,effectiveDailyTarget:row.effective_daily_calorie_target,cateringAllocation:row.catering_calorie_allocation,status:row.status,confidence:row.confidence,allergies:row.allergies,dietaryPreference:row.dietary_preference,explanationCodes:parse(row.explanation_codes_json),meals:db.prepare('SELECT meal_type mealType,menu_id menuId,calories,protein_g proteinG FROM catering_meals WHERE adaptive_plan_id=?').all(row.id)})); },
    createBindToken(userId,hash,expiresAt){db.prepare('INSERT INTO telegram_bind_tokens VALUES (?,?,?,?,?)').run(hash,userId,expiresAt,null,now());},
    bindTelegram(hash,telegramId){ const token=db.prepare('SELECT * FROM telegram_bind_tokens WHERE token_hash=?').get(hash); if(!token||token.used_at||new Date(token.expires_at)<=new Date())return null; const conflict=db.prepare('SELECT user_id FROM telegram_connections WHERE telegram_user_id=?').get(String(telegramId)); if(conflict&&conflict.user_id!==token.user_id)throw Object.assign(new Error('Telegram account is already connected'),{statusCode:409}); db.exec('BEGIN'); try{db.prepare('INSERT INTO telegram_connections VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET telegram_user_id=excluded.telegram_user_id,connected_at=excluded.connected_at').run(token.user_id,String(telegramId),now()); db.prepare('UPDATE telegram_bind_tokens SET used_at=? WHERE token_hash=?').run(now(),hash); db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;} return token.user_id;},
    telegramUser(telegramId){return db.prepare('SELECT u.* FROM users u JOIN telegram_connections t ON t.user_id=u.id WHERE t.telegram_user_id=?').get(String(telegramId));},
    telegramStatus(userId){const row=db.prepare('SELECT telegram_user_id,connected_at FROM telegram_connections WHERE user_id=?').get(userId);return row?{connected:true,telegramUserId:row.telegram_user_id,connectedAt:row.connected_at}:{connected:false};},
    audit(eventType,{userId=null,actorUserId=null,entityType=null,entityId=null,detail={}}={}){db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?)').run(`audit_${crypto.randomUUID()}`,userId,actorUserId,eventType,entityType,entityId,json(detail),now());}
  };
}

module.exports = { createStore, hashPassword, verifyPassword };
