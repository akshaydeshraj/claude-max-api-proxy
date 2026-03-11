import { Hono } from "hono";
import { getAvailableModels } from "../conversion/model-map.js";

const models = new Hono();

models.get("/v1/models", (c) => {
  return c.json({
    object: "list",
    data: getAvailableModels(),
  });
});

export { models };
