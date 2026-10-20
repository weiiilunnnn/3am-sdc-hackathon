import { Router, type IRouter } from "express";
import {
  SummarizeValuesBody,
  SummarizeValuesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/summarize", (req, res) => {
  const request = SummarizeValuesBody.safeParse(req.body);
  if (!request.success) {
    res.status(422).json({ detail: "values must contain between 1 and 1000 numbers" });
    return;
  }

  const { values } = request.data;
  const response = SummarizeValuesResponse.parse({
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
  });
  res.json(response);
});

export default router;
