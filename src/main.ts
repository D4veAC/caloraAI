import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT || 3005);
  await app.listen(port, '0.0.0.0');
  console.log(`Calora AI running on http://localhost:${port}`);
}

bootstrap();
