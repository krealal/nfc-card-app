import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDb } from "../db/mongo";
import { IMessageDoc } from "../types";

const unauthorized = (): APIGatewayProxyResult => ({
  statusCode: 401,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: "Unauthorized" })
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) return unauthorized();

    if (!event.body) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Missing body" }) };
    }

    const payload = JSON.parse(event.body) as Partial<IMessageDoc> | Partial<IMessageDoc>[];
    const docs = Array.isArray(payload) ? payload : [payload];

    for (const doc of docs) {
      if (!doc?.userId || !doc?.category || !doc?.text) {
        return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Fields required: userId, category, text" }) };
      }
    }

    const db = await getDb();
    const normalized = docs.map((d) => ({
      userId: d.userId!,
      messageId: d.messageId,
      category: d.category!,
      text: d.text!,
      active: d.active ?? true,
      weight: d.weight ?? 1
    }));

    const result = await db.collection<IMessageDoc>("messages").insertMany(normalized);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insertedCount: result.insertedCount })
    };
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

