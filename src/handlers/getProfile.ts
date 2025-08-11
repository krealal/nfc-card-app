import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDb } from "../db/mongo";
import { IUser, IMessageDoc } from "../types";
import { ObjectId } from "mongodb";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id?.trim();
    if (!id || id.length > 128) {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, 
        body: JSON.stringify({ error: "Invalid or missing 'id'" }) 
      };
    }

    const db = await getDb();
    
    // First, find the user
    const user = await db.collection<IUser>("users").findOne(
      { id }, 
      { projection: { _id: 0 } }
    );
    
    if (!user) {
      return { 
        statusCode: 404, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, 
        body: JSON.stringify({ error: "User not found" }) 
      };
    }

    // If user has no messagesCreated array, return user with empty messages
    if (!user.messagesCreated || user.messagesCreated.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          user: user,
          messages: []
        })
      };
    }

    // Convert string IDs to ObjectIds for MongoDB query
    const messageObjectIds = user.messagesCreated.map(id => {
      try {
        return new ObjectId(id);
      } catch (err) {
        console.warn(`Invalid ObjectId: ${id}`);
        return null;
      }
    }).filter(id => id !== null);
    
    // Fetch all messages by their IDs
    const messages = await db.collection<IMessageDoc>("messages")
      .find(
        { _id: { $in: messageObjectIds } } as any,
        { projection: { _id: 1, userId: 1, category: 1, text: 1, active: 1, weight: 1 } }
      )
      .toArray();

    // Convert ObjectId back to string for the response
    const messagesWithStringIds = messages.map(msg => ({
      ...msg,
      _id: msg._id?.toString()
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        user: user,
        messages: messagesWithStringIds
      })
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
