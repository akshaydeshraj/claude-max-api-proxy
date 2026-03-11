export const config = {
  port: parseInt(process.env.PORT || "3456", 10),
  apiKey: process.env.API_KEY || "",
  dbPath: process.env.DB_PATH || "./data/analytics.db",
  maxConcurrentRequests: parseInt(
    process.env.MAX_CONCURRENT_REQUESTS || "3",
    10,
  ),
  maxBudgetPerRequest: parseFloat(process.env.MAX_BUDGET_PER_REQUEST || "0.50"),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "300000", 10),
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || "24", 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  allowedEmails: (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  publicUrl: process.env.PUBLIC_URL || "http://localhost:3456",
};
