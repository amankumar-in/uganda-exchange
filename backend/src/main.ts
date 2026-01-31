import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getAllowedOrigins } from './cors.utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for Stripe webhooks
  });
  
  // Enable CORS (allows both www and non-www of FRONTEND_URL in production)
  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
  });
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // API prefix
  app.setGlobalPrefix('api');
  
  const port = process.env.PORT || 8000;
  await app.listen(port);
  
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api`);
}
bootstrap();
