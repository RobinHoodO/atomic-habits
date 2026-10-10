import assert from "node:assert";
import { isUniqueViolation } from "./db-errors";

assert.equal(isUniqueViolation({ code: "23505" }), true, "Postgres unique violations are recognized");
assert.equal(
  isUniqueViolation({ cause: { code: "23505" } }),
  true,
  "nested Postgres unique violations are recognized",
);
assert.equal(
  isUniqueViolation(new Error("UNIQUE constraint failed: users.email")),
  true,
  "libsql unique-constraint messages are recognized",
);
assert.equal(
  isUniqueViolation({ code: "SQLITE_CONSTRAINT", message: "UNIQUE constraint failed: users.email" }),
  true,
  "SQLite constraint codes with unique-constraint messages are recognized",
);

const timeout = Object.assign(new Error("database connection timed out"), { code: "ETIMEDOUT" });
assert.equal(isUniqueViolation(timeout), false, "timeouts are not unique violations");
assert.equal(isUniqueViolation(new Error("relation users does not exist")), false, "other errors are not unique violations");
assert.equal(isUniqueViolation("23505"), false, "non-object values are not unique violations");

try {
  throw timeout;
} catch (error: unknown) {
  assert.equal(isUniqueViolation(error), false, "thrown non-unique errors are not classified as unique");
}

console.log("✓ all db-errors checks passed");
