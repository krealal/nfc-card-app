import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDb } from "../db/mongo";
import { IMessageDoc } from "../types";

const unauthorized = (): APIGatewayProxyResult => ({
  statusCode: 401,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify({ error: "Unauthorized" })
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) return unauthorized();

    if (!event.body) {
      return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Missing body" }) };
    }

    const payload = JSON.parse(event.body) as Partial<IMessageDoc> | Partial<IMessageDoc>[];
    const docs = Array.isArray(payload) ? payload : [payload];

    // Debug log
    console.log("Received payload:", JSON.stringify(payload, null, 2));

    for (const doc of docs) {
      if (!doc?.userId || !doc?.category || !doc?.text) {
        console.log("Validation failed for doc:", doc);
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Fields required: userId, category, text" }) };
      }
    }

    const db = await getDb();
    const normalized = docs.map((d) => ({
      userId: d.userId!, // es necesario? realmente sólo lo necesito para saber quien lo ha creado
      category: d.category!,
      text: d.text!,
      active: d.active ?? true,
      weight: d.weight ?? 1
    }));

    const result = await db.collection<IMessageDoc>("messages").insertMany(normalized);
    
    // Extract the inserted IDs as strings
    const insertedIds = Object.values(result.insertedIds).map(id => id.toString());

    // Update each user's messagesCreated array with their new message IDs
    const userUpdates = new Map<string, string[]>();
    
    // Group inserted IDs by userId
    normalized.forEach((doc, index) => {
      const userId = doc.userId;
      const messageId = insertedIds[index];
      
      if (!userUpdates.has(userId)) {
        userUpdates.set(userId, []);
      }
      userUpdates.get(userId)!.push(messageId);
    });

    // Update each user's messagesCreated array
    const updatePromises = Array.from(userUpdates.entries()).map(([userId, messageIds]) =>
      db.collection("users").updateOne(
        { id: userId },
        { $push: { messagesCreated: { $each: messageIds } } } as any,
        { upsert: false } // Don't create user if it doesn't exist
      )
    );

    await Promise.all(updatePromises);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        insertedCount: result.insertedCount,
        insertedIds: insertedIds,
        usersUpdated: userUpdates.size
      })
    };
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

