import { buildApp } from "./lib/app.js";

const app = buildApp();

async function main() {
  try {
    await app.listen({
      host: "0.0.0.0",
      port: app.config.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void main();
