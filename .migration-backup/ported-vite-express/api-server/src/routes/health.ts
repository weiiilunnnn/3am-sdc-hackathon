import { Router, type IRouter } from "express";
import {
  GetProjectHealthResponse,
  HealthCheckResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatGreeting(name: string): string {
  return `Welcome to ${name}!`;
}

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", (_req, res) => {
  const data = GetProjectHealthResponse.parse({
    status: "ok",
    message: formatGreeting(process.env.PROJECT_NAME ?? "Hackathon API"),
  });
  res.json(data);
});

export default router;
