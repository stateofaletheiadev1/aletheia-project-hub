// The Employee model: validation rules, and the shape the API returns.
import { z } from "zod";

export const GENDERS = ["male", "female", "other"];

const fields = {
  fullname: z.string().trim().min(2, "fullname must be at least 2 characters").max(100),
  address: z.string().trim().min(5, "address must be at least 5 characters").max(200),
  email: z.email("email must be a valid email address").trim().toLowerCase(),
  telephone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "telephone must be 7-20 digits, optionally starting with +"),
  gender: z.enum(GENDERS, { error: `gender must be one of: ${GENDERS.join(", ")}` }),
  salary: z.number({ error: "salary must be a number" }).nonnegative("salary cannot be negative").max(100_000_000),
};

/** POST and PUT: every field is required. created_at is set by the server. */
export const EmployeeInput = z.strictObject(fields);

/** PATCH: any subset of fields, at least one. */
export const EmployeePatch = z
  .strictObject(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "send at least one field to update");

/** Turns a stored AletheiaDB document into the API's employee shape. */
export function toEmployee(doc) {
  return {
    id: doc._id,
    fullname: doc.fullname,
    address: doc.address,
    email: doc.email,
    telephone: doc.telephone,
    gender: doc.gender,
    salary: doc.salary,
    created_at: doc.created_at,
    updated_at: doc._updatedAt,
    version: doc._rev,
  };
}
