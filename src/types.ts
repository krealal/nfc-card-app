export type ResponseKind = "default" | "static" | "redirect" | "json";
export interface IUser { id: string; response: ResponseKind; }
export interface IMessageDoc { _id?: string; userId: string; messageId?: string; category: string; text: string; active?: boolean; weight?: number; }

