import "server-only";
import { database } from "@/server/aletheiadb/client";
import { decryptRegistration, positionTypesOf, registrations, type InterestStatus } from "@/server/services/interest";

// Read models for workbench screens. Callers must have checked permissions first.

export type RegistrationRow = {
  _id: string;
  _rev: number;
  reference: string;
  submittedAt: string;
  updatedAt: string;
  retainUntil: string;
  positionTypes: string[];
  institutions: string[];
  expertise: string[];
  status: InterestStatus;
  cvs: { fileId: string; name: string; size: number; uploadedAt: string }[];
  name: string;
  email: string;
  notes: { text: string; at: string }[];
};

export async function listRegistrations(opts: { institution?: string; positionType?: string; status?: string; page: number; pageSize: number }) {
  const db = database()!;
  const filter: Record<string, unknown> = {};
  if (opts.institution) filter.institutions = opts.institution;
  // Early registrations have no positionTypes and count as founding.
  if (opts.positionType === "founding") filter.$or = [{ positionTypes: "founding" }, { positionTypes: { $exists: false } }];
  else if (opts.positionType) filter.positionTypes = opts.positionType;
  if (opts.status) filter.status = opts.status;
  const [page, total] = await Promise.all([
    registrations(db).find(filter, { sort: { submittedAt: -1 }, limit: opts.pageSize, skip: (opts.page - 1) * opts.pageSize }),
    registrations(db).count(filter),
  ]);
  const rows = await Promise.all(page.documents.map(async (r) => toRow(r, await decryptRegistration(db, r))));
  return { rows, total, hasMore: page.hasMore };
}

export async function getRegistration(reference: string): Promise<RegistrationRow | null> {
  if (!/^AGV-EOI-\d{4}-\d{4,}$/.test(reference)) return null;
  const db = database()!;
  const r = await registrations(db).findOne({ reference });
  return r ? toRow(r, await decryptRegistration(db, r)) : null;
}

export async function registrationCounts() {
  const db = database()!;
  const [total, fresh, contacted] = await Promise.all([registrations(db).count({}), registrations(db).count({ status: "new" }), registrations(db).count({ status: "contacted" })]);
  return { total, fresh, contacted };
}

function toRow(r: Awaited<ReturnType<ReturnType<typeof registrations>["findOne"]>> & object, pii: { fullName: string; email: string; notes: { text: string; at: string }[] } | null): RegistrationRow {
  return {
    _id: r._id,
    _rev: r._rev,
    reference: r.reference,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    retainUntil: r.retainUntil,
    positionTypes: positionTypesOf(r),
    institutions: r.institutions,
    expertise: r.expertise,
    status: r.status,
    cvs: r.cvs.map((c) => ({ fileId: c.fileId, name: c.name, size: c.size, uploadedAt: c.uploadedAt })),
    name: pii?.fullName ?? "(erased)",
    email: pii?.email ?? "",
    notes: pii?.notes ?? [],
  };
}
