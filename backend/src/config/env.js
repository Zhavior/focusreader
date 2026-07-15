const z = require("zod");

const envSchema = z.object({
  PORT: z.string().transform(Number).default("4000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TTS_PROVIDER: z.enum(["edge", "elevenlabs", "opensource", "local"]).default("edge"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().optional(),
  DATA_DIR: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000,http://localhost:3001"),
  ALLOWED_EXTENSION_IDS: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info")
}).superRefine((data, ctx) => {
  if (data.TTS_PROVIDER === "elevenlabs" && !data.ELEVENLABS_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ELEVENLABS_API_KEY is required when TTS_PROVIDER=elevenlabs"
    });
  }
});

let config;
try {
  config = envSchema.parse(process.env);
} catch (err) {
  console.error("FATAL: Environment configuration validation failed:");
  if (err instanceof z.ZodError) {
    err.errors.forEach(e => {
      console.error(`  - [${e.path.join(".")}] ${e.message}`);
    });
  } else {
    console.error(err);
  }
  if (process.env.NODE_ENV !== "test") {
    process.exit(1);
  } else {
    // In test environment, throw so test runners catch malformed env safely
    throw err;
  }
}

module.exports = { config };
