export type ResponseKind = "default" | "static" | "redirect" | "json";
export interface IUser { id: string; response: ResponseKind; name?: string; messagesCreated?: string[]; }
export interface IMessageDoc { _id?: string; userId: string; category: string; text: string; active?: boolean; weight?: number; }

