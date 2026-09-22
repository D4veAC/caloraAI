const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./db.js');

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {}
}
loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 3005);
const DATA_DIR = process.env.CALORA_DATA_DIR || path.join(__dirname, 'data');
const MAX_BODY_BYTES = 1024 * 1024;
const SESSION_TTL_MS = 30 * 60 * 1000;
const WEBHOOK_TOKEN = process.env.CALORA_WEBHOOK_TOKEN || '';
const CUTOFF_HOUR = Number(process.env.CALORA_CATERING_CUTOFF_HOUR || 20);
const TELEGRAM_BIND_TTL_MINUTES = Number(process.env.TELEGRAM_BIND_TTL_MINUTES || 30);
const DEFAULT_USERS = process.env.NODE_ENV === 'production' ? [] : [
  { id: 'dave', name: 'Dave', email: 'dave@local.test', password: '1234', role: 'USER', profile: { bb: 68, tb: 175, age: 25, sex: 'male', activity: 'moderate', goal: 'maintain' } },
  { id: 'alex', name: 'Alex', email: 'alex@local.test', password: '5678', role: 'USER', profile: { bb: 55, tb: 165, age: 24, sex: 'female', activity: 'light', goal: 'maintain' } },
  { id: 'admin-local', name: 'Admin', email: 'admin@local.test', password: '2468', role: 'ADMIN', profile: { bb: 70, tb: 175, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain' } }
];

function configuredUsers() {
  if (!process.env.CALORA_USERS_JSON) return DEFAULT_USERS;
  const users = JSON.parse(process.env.CALORA_USERS_JSON);
  if (!Array.isArray(users) || users.some(user => !user.id || !user.name || (!user.password && !user.passwordHash))) throw new Error('CALORA_USERS_JSON is invalid');
  return users;
}

const store = createStore(DATA_DIR, configuredUsers());
const nutritionDomain = import('./js/domain/nutrition.mjs');
const cateringDomain = import('./js/domain/catering.mjs');
const sessions = new Map();
const rateLimits = new Map();

function migrateJsonOnce() {
  if (store.db.prepare('SELECT 1 ok FROM schema_migrations WHERE version=2').get()) return;
  for (const user of store.listUsers()) {
    try {
      const legacy = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users', `${user.id}.json`), 'utf8'));
      if (legacy.profile) store.updateProfile(user.id, validateProfile(legacy.profile, store.getProfile(user.id)));
      for (const item of legacy.foodLogs || []) { try { store.insertFood(user.id, validateFood(item)); } catch {} }
      for (const item of legacy.workouts || []) {
        try { store.insertActivity(user.id, validateActivity({ id:item.id,provider:item.source || 'MANUAL',providerActivityId:item.id,activityType:item.name || 'WORKOUT',name:item.name,startedAt:item.createdAt || item.timestamp || Date.now(),durationSeconds:Number(item.duration || 0)*60,distanceMeters:Number(item.distance || 0)*1000,estimatedEnergyKcal:item.calories,dataQuality:'ESTIMATED' })); } catch {}
      }
    } catch {}
  }
  store.db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES (?,?)').run(2,new Date().toISOString());
}

function json(res, status, payload, headers = {}) { res.writeHead(status, { 'Content-Type':'application/json; charset=UTF-8', ...headers }); res.end(JSON.stringify(payload)); }
function parseCookies(req) { return Object.fromEntries(String(req.headers.cookie || '').split(';').map(value=>value.trim()).filter(Boolean).map(value=>{const i=value.indexOf('=');return i<0?[value,'']:[value.slice(0,i),decodeURIComponent(value.slice(i+1))];})); }
function safeEqual(left,right) { const a=Buffer.from(String(left));const b=Buffer.from(String(right));return a.length===b.length&&crypto.timingSafeEqual(a,b); }
function sessionUser(req) { const token=parseCookies(req).calora_session;const session=token&&sessions.get(token);if(!session)return null;if(session.expiresAt<=Date.now()){sessions.delete(token);return null;}session.expiresAt=Date.now()+SESSION_TTL_MS;return store.findUserById(session.userId)||null; }
function requireUser(req) { const user=sessionUser(req);if(!user)throw Object.assign(new Error('Authentication required'),{statusCode:401});return user; }
function requireAdmin(req) { const user=requireUser(req);if(user.role!=='ADMIN')throw Object.assign(new Error('Admin role required'),{statusCode:403});return user; }
function importAuthorized(req) { const auth=String(req.headers.authorization||'');return Boolean(WEBHOOK_TOKEN)&&safeEqual(auth,`Bearer ${WEBHOOK_TOKEN}`); }
function importUser(req) { if(!importAuthorized(req))return null;return store.findUserById(String(req.headers['x-calora-user']||''))||null; }
function sameOrigin(req) { const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;} }
function isRateLimited(req) { const key=`${req.socket.remoteAddress||'unknown'}:${req.url}`;const current=rateLimits.get(key);const timestamp=Date.now();if(!current||current.resetAt<=timestamp){rateLimits.set(key,{count:1,resetAt:timestamp+60_000});return false;}return ++current.count>30; }
function readBody(req) { return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>MAX_BODY_BYTES){reject(Object.assign(new Error('Request body is too large'),{statusCode:413}));req.destroy();return;}chunks.push(chunk);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}catch{reject(Object.assign(new Error('Invalid JSON payload'),{statusCode:400}));}});req.on('error',reject);}); }
const numeric=(value,key,min,max)=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Object.assign(new Error(`Invalid ${key}`),{statusCode:400});return n;};
function validateProfile(input={},current={}) { const pick=(key,allowed,fallback)=>allowed.includes(input[key])?input[key]:fallback;return {bb:numeric(input.bb??current.bb,'bb',30,350),tb:numeric(input.tb??current.tb,'tb',120,230),age:numeric(input.age??current.age,'age',18,100),sex:pick('sex',['male','female'],current.sex||'male'),activity:pick('activity',['sedentary','light','moderate','active'],current.activity||'moderate'),goal:pick('goal',['lose','maintain','gain'],current.goal||'maintain'),targetWeightKg:numeric(input.targetWeightKg??current.targetWeightKg??input.bb??current.bb,'targetWeightKg',30,350),rateKgPerWeek:numeric(input.rateKgPerWeek??current.rateKgPerWeek??0.25,'rateKgPerWeek',0,1),dietaryPreference:pick('dietaryPreference',['none','vegetarian','vegan','pescatarian'],current.dietaryPreference||'none'),allergies:String(input.allergies??current.allergies??'').slice(0,300),dislikedFoods:String(input.dislikedFoods??current.dislikedFoods??'').slice(0,300),timezone:String(input.timezone??current.timezone??'Asia/Bangkok').slice(0,80)}; }
function validateFood(input={}) { const meal=String(input.meal||input.mealName||'').trim();if(!meal||meal.length>120)throw Object.assign(new Error('Meal name is required'),{statusCode:400});const createdAt=new Date(input.createdAt||input.eatenAt||Date.now());if(Number.isNaN(createdAt.getTime()))throw Object.assign(new Error('Invalid eatenAt'),{statusCode:400});const nutrient=(key,required=false)=>{const value=numeric(input[key]??0,key,0,100000);if(required&&value<=0)throw Object.assign(new Error(`Invalid ${key}`),{statusCode:400});return value;};return {id:String(input.id||`food_${crypto.randomUUID()}`).slice(0,100),meal,category:['breakfast','lunch','dinner','snack'].includes(String(input.category||'').toLowerCase())?String(input.category).toLowerCase():'snack',kcal:nutrient('kcal',true),protein:nutrient('protein'),carbs:nutrient('carbs'),fat:nutrient('fat'),sugar:nutrient('sugar'),sodium:nutrient('sodium'),source:String(input.source||'MANUAL').slice(0,30),confidence:input.confidence==null?null:Math.min(1,Math.max(0,Number(input.confidence)||0)),createdAt:createdAt.toISOString()}; }
function validateWeight(input={}) { const measuredAt=new Date(input.measuredAt||Date.now());if(Number.isNaN(measuredAt.getTime()))throw Object.assign(new Error('Invalid measuredAt'),{statusCode:400});return {id:String(input.id||`weight_${crypto.randomUUID()}`),weightKg:numeric(input.weightKg,'weightKg',30,350),measuredAt:measuredAt.toISOString(),source:String(input.source||'MANUAL').slice(0,30)}; }
function validateActivity(input={}) { const startedAt=new Date(input.startedAt||Date.now());if(Number.isNaN(startedAt.getTime()))throw Object.assign(new Error('Invalid startedAt'),{statusCode:400});const provider=String(input.provider||'MANUAL').toUpperCase();return {id:String(input.id||`activity_${crypto.randomUUID()}`),provider,providerActivityId:input.providerActivityId==null?null:String(input.providerActivityId).slice(0,120),activityType:String(input.activityType||input.name||'OTHER').slice(0,60),name:String(input.name||input.activityName||'Activity').slice(0,120),startedAt:startedAt.toISOString(),durationSeconds:input.durationSeconds==null?null:numeric(input.durationSeconds,'durationSeconds',0,604800),distanceMeters:input.distanceMeters==null?null:numeric(input.distanceMeters,'distanceMeters',0,1000000),estimatedEnergyKcal:input.estimatedEnergyKcal==null?null:numeric(input.estimatedEnergyKcal,'estimatedEnergyKcal',0,10000),energySource:String(input.energySource||'USER_ESTIMATE').slice(0,40),dataQuality:String(input.dataQuality||'ESTIMATED').slice(0,30)}; }
function healthConnectActivities(body={}) { const records=body.exercise||body.exercise_session||[];return (Array.isArray(records)?records:[]).map(record=>validateActivity({id:`hc_${String(record.id||crypto.randomUUID())}`,provider:'HEALTH_CONNECT',providerActivityId:String(record.id||''),activityType:record.type||'WORKOUT',name:record.title||record.type||'Health Connect activity',startedAt:record.start_time||Date.now(),durationSeconds:Number(record.duration_seconds)||((record.start_time&&record.end_time)?Math.max(0,(new Date(record.end_time)-new Date(record.start_time))/1000):null),distanceMeters:Number(record.distance_meters||record.total_distance_meters)||null,estimatedEnergyKcal:Number(record.total_calories||record.calories)||null,energySource:'PROVIDER_ESTIMATE',dataQuality:'ESTIMATED'})); }

async function ensurePlan(userId, date = new Date()) {
  const { calculateNutritionTargets } = await nutritionDomain;
  const { calculateRollingNutritionState, generateTomorrowCateringPlan, explainPlan } = await cateringDomain;
  const profile=store.getProfile(userId);const rollingState=calculateRollingNutritionState({foodLogs:store.listFood(userId),weightLogs:store.listWeights(userId),activityLogs:store.listActivities(userId),profile,windowDays:7,now:date});
  const existing=store.getPlan(userId,new Date(date.getTime()+86_400_000).toISOString().slice(0,10));
  const plan=existing?.status==='LOCKED'?existing:store.savePlan(userId,generateTomorrowCateringPlan({profile,rollingState,menus:store.listMenus(),recentMenuIds:store.recentMenuIds(userId),now:date,cutoffHour:CUTOFF_HOUR}));
  return {...plan,explanations:explainPlan({...plan,rollingState:plan.rollingState||rollingState}),targets:calculateNutritionTargets(profile)};
}

async function dashboardFor(userId) { const {calculateDailyNutritionState,calculateNutritionTargets}=await nutritionDomain;const profile=store.getProfile(userId);const foodLogs=store.listFood(userId);const targets=calculateNutritionTargets(profile);return {profile,foodLogs,activities:store.listActivities(userId),weights:store.listWeights(userId),today:calculateDailyNutritionState(foodLogs,targets),tomorrow:await ensurePlan(userId),targets}; }
async function refreshPlan(userId) { return ensurePlan(userId).catch(error=>console.error('Plan recompute failed',error.message)); }

const MIME_TYPES={'.html':'text/html; charset=UTF-8','.css':'text/css; charset=UTF-8','.js':'application/javascript; charset=UTF-8','.mjs':'application/javascript; charset=UTF-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const ROOT_ASSETS=new Set(['index.html','admin.html','styles.css','app.js','athlete.png','frame1.png','frame2.png','frame3.png','frame4.png','hero.png','muscular_constellation.png','michelle.glb','runner.glb','soldier.glb']);
function serveStatic(pathname,res){const relative=pathname==='/'?'index.html':pathname==='/admin'?'admin.html':decodeURIComponent(pathname).replace(/^\/+/, '');const allowed=ROOT_ASSETS.has(relative)||relative.startsWith('css/')||relative.startsWith('js/');if(!allowed||relative.split('/').some(part=>part.startsWith('.')))return json(res,404,{error:'Not found'});const file=path.resolve(__dirname,relative);if(!file.startsWith(`${path.resolve(__dirname)}${path.sep}`))return json(res,403,{error:'Forbidden'});try{if(!fs.statSync(file).isFile())throw new Error();res.writeHead(200,{'Content-Type':MIME_TYPES[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res);}catch{json(res,404,{error:'Not found'});}}
function secureHeaders(res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');}

migrateJsonOnce();

const server=http.createServer(async(req,res)=>{
  secureHeaders(res);const requestUrl=new URL(req.url,`http://${req.headers.host||'localhost'}`);const pathname=requestUrl.pathname;
  try{
    if(pathname.startsWith('/api/')&&['POST','PUT','DELETE'].includes(req.method)){if(!sameOrigin(req))return json(res,403,{error:'Invalid request origin'});if(isRateLimited(req))return json(res,429,{error:'Too many requests'},{'Retry-After':'60'});}
    if(pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,database:'sqlite',engine:'adaptive-v2'});
    if(pathname==='/api/session'&&req.method==='POST'){const body=await readBody(req);const user=store.findUserByName(String(body.username||'').trim());if(!user||!store.verifyPassword(body.password||'',user.password_hash))return json(res,401,{error:'Invalid credentials'});const token=crypto.randomBytes(32).toString('base64url');sessions.set(token,{userId:user.id,expiresAt:Date.now()+SESSION_TTL_MS});const secure=process.env.NODE_ENV==='production'?'; Secure':'';return json(res,200,{user:store.publicUser(user.id)},{'Set-Cookie':`calora_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${secure}`});}
    if(pathname==='/api/session'&&req.method==='GET'){const user=sessionUser(req);return user?json(res,200,{user:store.publicUser(user.id)}):json(res,401,{error:'Authentication required'});}
    if(pathname==='/api/session'&&req.method==='DELETE'){const token=parseCookies(req).calora_session;if(token)sessions.delete(token);return json(res,200,{success:true},{'Set-Cookie':'calora_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
    if(pathname==='/api/dashboard'&&req.method==='GET'){const user=requireUser(req);return json(res,200,await dashboardFor(user.id));}
    if(pathname==='/api/profile'){const user=requireUser(req);if(req.method==='GET')return json(res,200,store.getProfile(user.id));if(req.method==='PUT'){const profile=store.updateProfile(user.id,validateProfile(await readBody(req),store.getProfile(user.id)));store.audit('PROFILE_UPDATED',{userId:user.id,actorUserId:user.id,entityType:'nutrition_profile',entityId:user.id});await refreshPlan(user.id);return json(res,200,profile);}}
    if(pathname==='/api/food'&&req.method==='GET'){const user=requireUser(req);return json(res,200,store.listFood(user.id));}
    if(pathname==='/api/food'&&req.method==='POST'){const user=requireUser(req);const entry=validateFood(await readBody(req));try{store.insertFood(user.id,entry);}catch(error){if(String(error.message).includes('UNIQUE'))return json(res,409,{error:'Duplicate entry'});throw error;}store.audit('FOOD_CREATED',{userId:user.id,actorUserId:user.id,entityType:'food_log',entityId:entry.id});await refreshPlan(user.id);return json(res,201,entry);}
    const foodItem=pathname.match(/^\/api\/food\/([^/]+)$/);if(foodItem&&['PUT','DELETE'].includes(req.method)){const user=requireUser(req);const id=decodeURIComponent(foodItem[1]);if(req.method==='PUT'){const entry=validateFood({...await readBody(req),id});const updated=store.updateFood(user.id,id,entry);if(!updated)return json(res,404,{error:'Food entry not found'});await refreshPlan(user.id);return json(res,200,updated);}if(!store.deleteFood(user.id,id))return json(res,404,{error:'Food entry not found'});await refreshPlan(user.id);return json(res,200,{success:true});}
    if(pathname==='/api/weight'&&req.method==='GET'){const user=requireUser(req);return json(res,200,store.listWeights(user.id));}
    if(pathname==='/api/weight'&&req.method==='POST'){const user=requireUser(req);const entry=validateWeight(await readBody(req));store.insertWeight(user.id,entry);await refreshPlan(user.id);return json(res,201,entry);}
    const weightItem=pathname.match(/^\/api\/weight\/([^/]+)$/);if(weightItem&&req.method==='DELETE'){const user=requireUser(req);if(!store.deleteWeight(user.id,decodeURIComponent(weightItem[1])))return json(res,404,{error:'Weight entry not found'});await refreshPlan(user.id);return json(res,200,{success:true});}
    if(pathname==='/api/activity'&&req.method==='GET'){const user=requireUser(req);return json(res,200,store.listActivities(user.id));}
    if(pathname==='/api/activity'&&req.method==='POST'){const user=requireUser(req);const body=await readBody(req);body.provider='MANUAL';const entry=validateActivity(body);store.insertActivity(user.id,entry);await refreshPlan(user.id);return json(res,201,entry);}
    const activityItem=pathname.match(/^\/api\/activity\/([^/]+)$/);if(activityItem&&req.method==='DELETE'){const user=requireUser(req);if(!store.deleteActivity(user.id,decodeURIComponent(activityItem[1])))return json(res,404,{error:'Activity not found'});await refreshPlan(user.id);return json(res,200,{success:true});}
    if(pathname==='/api/workout'&&req.method==='GET'){const user=requireUser(req);return json(res,200,store.listActivities(user.id));}
    if(pathname==='/api/workout'&&req.method==='POST'){const user=importUser(req);if(!user)return json(res,401,{error:'Valid importer token required'});const entries=healthConnectActivities(await readBody(req));if(!entries.length)return json(res,400,{error:'No supported activity records found'});entries.forEach(entry=>store.insertActivity(user.id,entry));await refreshPlan(user.id);return json(res,201,{success:true,entries});}
    if(pathname==='/api/telegram/status'&&req.method==='GET'){const user=requireUser(req);return json(res,200,store.telegramStatus(user.id));}
    if(pathname==='/api/telegram/bind-token'&&req.method==='POST'){const user=requireUser(req);const token=crypto.randomBytes(24).toString('base64url');const hash=crypto.createHash('sha256').update(token).digest('hex');const expiresAt=new Date(Date.now()+TELEGRAM_BIND_TTL_MINUTES*60_000).toISOString();store.createBindToken(user.id,hash,expiresAt);store.audit('TELEGRAM_BIND_TOKEN_CREATED',{userId:user.id,actorUserId:user.id});const username=String(process.env.TELEGRAM_BOT_USERNAME||'').replace(/^@/,'');return json(res,201,{expiresAt,startPayload:`bind_${token}`,deepLink:username?`https://t.me/${username}?start=bind_${token}`:null});}
    if(pathname==='/api/telegram/bind'&&req.method==='POST'){if(!importAuthorized(req))return json(res,401,{error:'Valid importer token required'});const body=await readBody(req);const token=String(body.token||'');const telegramUserId=String(body.telegramUserId||'');if(!token||!telegramUserId)return json(res,400,{error:'Token and Telegram user ID are required'});const hash=crypto.createHash('sha256').update(token).digest('hex');const userId=store.bindTelegram(hash,telegramUserId);if(!userId)return json(res,400,{error:'Bind token is invalid, expired, or already used'});store.audit('TELEGRAM_BOUND',{userId,entityType:'telegram_connection',entityId:telegramUserId});return json(res,200,{success:true});}
    if(pathname==='/api/telegram/food'&&['GET','POST'].includes(req.method)){if(!importAuthorized(req))return json(res,401,{error:'Valid importer token required'});const body=req.method==='POST'?await readBody(req):{};const telegramUserId=body.telegramUserId||requestUrl.searchParams.get('telegramUserId');const user=store.telegramUser(telegramUserId);if(!user)return json(res,404,{error:'Telegram account is not connected'});if(req.method==='GET')return json(res,200,store.listFood(user.id));const entry=validateFood(body.food||body);try{store.insertFood(user.id,entry);}catch(error){if(String(error.message).includes('UNIQUE'))return json(res,409,{error:'Duplicate entry'});throw error;}await refreshPlan(user.id);return json(res,201,entry);}
    if(pathname==='/api/admin/dashboard'&&req.method==='GET'){const admin=requireAdmin(req);for(const user of store.listUsers().filter(item=>item.role==='USER'))await refreshPlan(user.id);const tomorrow=new Date(Date.now()+86_400_000).toISOString().slice(0,10);const plans=store.adminPlans(tomorrow);return json(res,200,{date:tomorrow,metrics:{tomorrowOrders:plans.length,confirmedPlans:plans.filter(p=>p.status==='CONFIRMED').length,awaitingReview:plans.filter(p=>p.status==='DRAFT').length,lunchPortions:plans.filter(p=>p.meals.some(m=>m.mealType==='LUNCH')).length,dinnerPortions:plans.filter(p=>p.meals.some(m=>m.mealType==='DINNER')).length},plans,actor:{id:admin.id,name:admin.name}});}
    const adminStatus=pathname.match(/^\/api\/admin\/plans\/([^/]+)\/status$/);if(adminStatus&&req.method==='PUT'){const admin=requireAdmin(req);const {status}=await readBody(req);if(!['DRAFT','CONFIRMED','LOCKED','FULFILLED','CANCELLED'].includes(status))return json(res,400,{error:'Invalid plan status'});store.setPlanStatus(decodeURIComponent(adminStatus[1]),status);store.audit('PLAN_STATUS_CHANGED',{actorUserId:admin.id,entityType:'adaptive_plan',entityId:adminStatus[1],detail:{status}});return json(res,200,{success:true});}
    if(pathname.startsWith('/api/'))return json(res,404,{error:'API endpoint not found'});return serveStatic(pathname,res);
  }catch(error){if(!error.statusCode&&process.env.NODE_ENV!=='production')console.error(error);if(!res.headersSent)json(res,error.statusCode||500,{error:error.statusCode?error.message:'Internal server error'});}
});

if(require.main===module)server.listen(PORT,()=>console.log(`Calora AI running on http://localhost:${PORT}`));
module.exports={server,store,validateFood,validateProfile,validateActivity,ensurePlan};
