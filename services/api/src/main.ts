import "reflect-metadata";
import "dotenv/config";
import {
  Module,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { json } from "express";
import { randomUUID } from "node:crypto";
import { AuthService, localMode, requireLocal } from "./auth";
import { AppService } from "./service";
import { DocumentService } from "./documents";
import { AppController } from "./controller";
import { JobWorker } from "./worker";
@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp(),
      res = ctx.getResponse(),
      req = ctx.getRequest();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error.code === "23505"
          ? 409
          : 500;
    const detail = error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof detail === "string"
        ? detail
        : (detail as any)?.message ||
          (status === 409
            ? "This action already exists."
            : "The request could not complete. Please retry with the same request key.");
    if (status === 500)
      console.error("Request error", req.requestId, error.code || error.name);
    res.status(status).json({
      error: {
        code: (detail as any)?.code || `HTTP_${status}`,
        message,
        requestId: req.requestId,
        ...(typeof detail === "object" ? detail : {}),
      },
    });
  }
}
@Module({
  controllers: [AppController],
  providers: [AuthService, AppService, DocumentService, JobWorker],
})
export class AppModule {}
export async function bootstrap() {
  if (localMode()) requireLocal();
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
    throw new Error(
      "Hosted startup requires configured Supabase authentication and deliberate privileged MFA enrollment.",
    );
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "7mb" }));
  app.use(helmet());
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (
      process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });
  const rates = new Map<string, { count: number; until: number }>();
  app.use((req: any, res: any, next: any) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    res.setHeader("Cache-Control", "no-store");
    const key = `${req.ip}:${req.path.includes("/auth/") ? "auth" : "general"}`,
      limit = req.path.includes("/auth/") ? 60 : 600;
    let entry = rates.get(key);
    if (!entry || entry.until < Date.now()) {
      entry = { count: 0, until: Date.now() + 60000 };
      rates.set(key, entry);
    }
    if (++entry.count > limit)
      return res.status(429).json({
        error: {
          code: "RATE_LIMIT",
          message: "Please wait a minute before retrying.",
          requestId: req.requestId,
        },
      });
    next();
  });
  app.useGlobalFilters(new ErrorFilter());
  const spec = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Lagani simulation API")
      .setDescription(
        "Simulation only. All monetary values are strings in NPR paisa; 100 paisa = NPR 1. See packages/contracts/api.md for request/response models.",
      )
      .setVersion("0.1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("api/docs", app, spec);
  await app.listen(
    Number(process.env.PORT || 4000),
    process.env.HOST || "127.0.0.1",
  );
  console.log(`Lagani simulation API listening on ${await app.getUrl()}/api`);
  return app;
}
if (require.main === module) void bootstrap();
