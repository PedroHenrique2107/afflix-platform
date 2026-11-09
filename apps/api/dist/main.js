"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
require("dotenv/config");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./modules/app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.enableCors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173' });
    // Nunca use '0.0.0.0' para expor esta V1 sem autenticação.
    await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
}
void bootstrap();
//# sourceMappingURL=main.js.map