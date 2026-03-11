import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { chatCompletions } from "./routes/chat-completions.js";
import { models } from "./routes/models.js";
import { health } from "./routes/health.js";
import { config } from "./config.js";

const app = new Hono();

app.route("/", health);
app.route("/", models);
app.route("/", chatCompletions);

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Claude Max Proxy running on http://localhost:${info.port}`);
  },
);

export { app };
