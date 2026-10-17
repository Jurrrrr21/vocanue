import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generation/builds do not connect. Migration commands require a real DIRECT_URL.
  datasource: { url: process.env.DIRECT_URL ?? "postgresql://localhost:5432/vocanue" },
});
