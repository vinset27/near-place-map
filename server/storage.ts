import { and, eq } from "drizzle-orm";
import { type InsertUser, type User, users } from "@shared/schema";
import { db } from "./db";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) return undefined;
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) return undefined;
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) {
      throw new Error("DATABASE_URL not configured");
    }
    const rows = await db
      .insert(users)
      .values({
        username: insertUser.username,
        email: (insertUser as any).email ?? null,
        password: insertUser.password,
      })
      .returning();
    return rows[0];
  }
}

export const storage = new DbStorage();
