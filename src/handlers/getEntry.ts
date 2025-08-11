import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDb } from "../db/mongo";
import { IUser, IMessageDoc, ResponseKind } from "../types";

const fetchUserById = async (id: string): Promise<IUser | null> => {
  const db = await getDb();
  return db.collection<IUser>("users").findOne({ id }, { projection: { _id: 0 } });
};

const fetchRandomMessage = async (userId: string, category?: string) => {
  const db = await getDb();
  const pipeline: any[] = [
    { $match: { userId, active: { $ne: false }, ...(category ? { category } : {}) } },
    { $sample: { size: 1 } },
    { $project: { _id: 0 } }
  ];
  const [doc] = await db.collection<IMessageDoc>("messages").aggregate(pipeline).toArray();
  return doc ?? null;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id?.trim();
    if (!id || id.length > 128) {
      return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Invalid or missing 'id'" }) };
    }

    const category = event.queryStringParameters?.category?.trim();
    const user = await fetchUserById(id);
    if (!user) {
      return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "User not found" }) };
    }

    switch ((user.response ?? "default") as ResponseKind) {
      case "default": {
        const msg = await fetchRandomMessage(user.id, category);
        if (!msg) {
          return { statusCode: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "No active messages for this user" }) };
        }
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({ message: msg })
        };
      }

      case "static":
        return { statusCode: 501, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "static not implemented yet" }) };

      case "redirect":
      case "json":
      default:
        return { statusCode: 501, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: `Response type not implemented: ${user.response}` }) };
    }
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

