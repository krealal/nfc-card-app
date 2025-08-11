import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDb } from "../db/mongo";
import { IMessageDoc } from "../types";
import { ObjectId } from "mongodb";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id?.trim();
    if (!id || id.length > 128) {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, 
        body: JSON.stringify({ error: "Invalid or missing message 'id'" }) 
      };
    }

    // Validate ObjectId format
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch (err) {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, 
        body: JSON.stringify({ error: "Invalid ObjectId format" }) 
      };
    }

    const db = await getDb();
    
    // Find the message by ID
    const message = await db.collection<IMessageDoc>("messages").findOne(
      { _id: objectId } as any,
      { projection: { _id: 1, userId: 1, category: 1, text: 1, active: 1, weight: 1 } }
    );
    
    if (!message) {
      return { 
        statusCode: 404, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, 
        body: JSON.stringify({ error: "Message not found" }) 
      };
    }

    // Convert ObjectId back to string for the response
    const messageWithStringId = {
      ...message,
      _id: message._id?.toString()
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: messageWithStringId })
    };

  } catch (err: any) {
    console.error(err);
    return { 
      statusCode: 500, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, 
      body: JSON.stringify({ error: "Internal Server Error" }) 
    };
  }
};
