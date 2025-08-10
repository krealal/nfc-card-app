import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();
import { handler as getEntry } from "../handlers/getEntry";
import { handler as adminPutUser } from "../handlers/adminPutUser";
import { handler as adminPostMessage } from "../handlers/adminPostMessage";

const app = express();
app.use(bodyParser.json());
app.use(morgan(":method :url :status :res[content-length] - :response-time ms"));
console.log(`[local] Admin API key set? ${process.env.ADMIN_API_KEY ? "yes" : "no"}`);
console.log(`[local] DB set? ${process.env.MONGO_URI && process.env.DB_NAME ? "yes" : "no"}`);

const adapt = (
  lambda: (event: any) => Promise<{ statusCode: number; headers?: Record<string, string>; body?: string }>
) => async (req: express.Request, res: express.Response) => {
  const event = {
    httpMethod: req.method,
    headers: req.headers as Record<string, string>,
    pathParameters: req.params,
    queryStringParameters: Object.keys(req.query).length ? (req.query as Record<string, string>) : null,
    body: req.body ? JSON.stringify(req.body) : null
  };
  const start = Date.now();
  const result = await lambda(event);
  const durationMs = Date.now() - start;
  console.log(
    `[lambda] ${req.method} ${req.path} -> ${result.statusCode} (${durationMs}ms)`
  );
  res.status(result.statusCode);
  if (result.headers) Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  if (result.body) return res.send(result.body);
  return res.end();
};

app.get("/:id", adapt(getEntry as any));
app.put("/admin/users/:id", adapt(adminPutUser as any));
app.post("/admin/messages", adapt(adminPostMessage as any));
app.get("/health", (_req, res) => {
  res.json({ ok: true, mock: process.env.MONGO_MOCK === "true" || process.env.MONGO_MOCK === "1" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
console.log(`Local server running on http://localhost:${port}`);
});


