import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SeedService } from '../src/seed/seed.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.get(SeedService).seed();
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
