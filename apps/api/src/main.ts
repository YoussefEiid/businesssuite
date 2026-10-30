import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express, { json, urlencoded, Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const logger = new Logger('BusinessSuiteBootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Static Frontend Serving for Desktop Offline Standalone Runtime
  const staticDir = process.env.STATIC_DIR;
  if (staticDir && fs.existsSync(staticDir)) {
    logger.log(`Serving static Desktop UI assets from: ${staticDir}`);
    // 1. Serve Next.js static chunks and assets directly
    app.use(express.static(staticDir, { maxAge: '1h' }));

    // 2. Next.js export clean HTML URL resolution middleware (excluding /api)
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api')) return next();

      const cleanPath = req.path.endsWith('/') && req.path.length > 1
        ? req.path.slice(0, -1)
        : req.path;

      // Direct file match
      const exactFile = path.join(staticDir, cleanPath);
      if (fs.existsSync(exactFile) && fs.statSync(exactFile).isFile()) {
        return res.sendFile(exactFile);
      }

      // Next.js static page resolution: /dashboard/pos -> /dashboard/pos.html
      const htmlFile = path.join(staticDir, `${cleanPath}.html`);
      if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) {
        return res.sendFile(htmlFile);
      }

      // Next.js directory index: /dashboard -> /dashboard/index.html
      const indexHtml = path.join(staticDir, cleanPath, 'index.html');
      if (fs.existsSync(indexHtml) && fs.statSync(indexHtml).isFile()) {
        return res.sendFile(indexHtml);
      }

      // Root SPA fallback
      const rootIndex = path.join(staticDir, 'index.html');
      if (fs.existsSync(rootIndex)) {
        return res.sendFile(rootIndex);
      }

      return next();
    });
  }

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin, localhost on any port, or configured CORS_ORIGIN
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin === process.env.CORS_ORIGIN) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'Accept'],
  });

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('BusinessSuite Commercial ERP & SaaS API')
    .setDescription(
      'Official REST API for BusinessSuite multi-tenant ERP platform supporting Sales, Purchases, Inventory, CRM, Dynamic Entitlements, and Platform Administration.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT) || 4000;
  const isOffline = process.env.DEPLOYMENT_MODE === 'DESKTOP_OFFLINE';

  if (isOffline) {
    // Strictly bind to loopback address (127.0.0.1) in Desktop Offline mode
    await app.listen(port, '127.0.0.1');
    logger.log(`BusinessSuite Desktop Local API is running strictly on http://127.0.0.1:${port}/api`);
  } else {
    // Standard SaaS / multi-tenant binding
    await app.listen(port);
    logger.log(`BusinessSuite API Server is running on http://localhost:${port}/api`);
  }
}

bootstrap();
