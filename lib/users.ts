import "server-only";
import bcrypt from "bcryptjs";
import { dbGet, dbRun } from "./db";

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

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return dbGet<User>("SELECT * FROM users WHERE email = ?", [
    email.trim().toLowerCase(),
  ]);
}

export async function getUserById(id: number): Promise<PublicUser | undefined> {
  return dbGet<PublicUser>("SELECT id, email, name FROM users WHERE id = ?", [id]);
}

// Create a user; throws if the email already exists (UNIQUE constraint).
export async function createUser(
  email: string,
  name: string,
  password: string,
): Promise<number> {
  const hash = await bcrypt.hash(password, 10);
  const info = await dbRun(
    "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
    [email.trim().toLowerCase(), name.trim(), hash],
  );
  return Number(info.lastInsertRowid);
}
