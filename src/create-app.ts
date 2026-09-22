import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-exception.filter';

const ROOT = process.cwd();
const SPA_ROUTES = new Set(['/', '/dashboard', '/training', '/nutrition', '/trends']);
const ROOT_ASSETS = new Set(['index.html', 'admin.html', 'styles.css', 'app.js', 'athlete.png', 'frame1.png', 'frame2.png', 'frame3.png', 'frame4.png', 'hero.png', 'muscular_constellation.png', 'michelle.glb', 'runner.glb', 'soldier.glb']);

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalFilters(new HttpErrorFilter());
  app.use(cookieParser());
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/admin', (_req, res) => res.sendFile(join(ROOT, 'admin.html')));
  expressApp.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    if (SPA_ROUTES.has(req.path)) return res.sendFile(join(ROOT, 'index.html'));
    const relative = decodeURIComponent(req.path.replace(/^\/+/, ''));
    const allowed = ROOT_ASSETS.has(relative) || relative.startsWith('css/') || relative.startsWith('js/');
    const file = join(ROOT, relative);
    if (!allowed || relative.split('/').some(part => part.startsWith('.')) || !existsSync(file)) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.sendFile(file);
  });
  return app;
}
