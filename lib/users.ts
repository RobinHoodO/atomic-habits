import "server-only";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}

export interface PublicUser {
  id: number;
  email: string;
  name: string;
}

export function getUserByEmail(email: string): User | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as User | undefined;
}

export function getUserById(id: number): PublicUser | undefined {
  return getDb()
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .get(id) as PublicUser | undefined;
}

// Create a user; throws if the email already exists (UNIQUE constraint).
export async function createUser(
  email: string,
  name: string,
  password: string,
): Promise<number> {
  const hash = await bcrypt.hash(password, 10);
  const info = getDb()
    .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
    .run(email.trim().toLowerCase(), name.trim(), hash);
  return Number(info.lastInsertRowid);
}
