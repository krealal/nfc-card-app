import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDb } from "../db/mongo";
import { IUser, ResponseKind } from "../types";

const unauthorized = (): APIGatewayProxyResult => ({
  statusCode: 401,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify({ error: "Unauthorized" })
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) return unauthorized();

    const id = event.pathParameters?.id?.trim();
    if (!id || id.length > 128) {
      return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Invalid or missing 'id'" }) };
    }

    const body = event.body ? (JSON.parse(event.body) as Partial<IUser>) : {};
    const response = (body.response ?? "default") as ResponseKind;
    if (!(["default", "static", "redirect", "json"] as const).includes(response)) {
      return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Invalid response kind" }) };
    }

    const db = await getDb();
    await db.collection<IUser>("users").updateOne(
      { id },
      { $set: { id, response } },
      { upsert: true }
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ id, response })
    };
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

