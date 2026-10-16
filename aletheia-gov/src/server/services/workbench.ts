import "server-only";
import { database } from "@/server/aletheiadb/client";
import { decryptRegistration, positionTypesOf, registrations, type InterestStatus, type StatusChange } from "@/server/services/interest";

// Read models for workbench screens. Callers must have checked permissions first.

export type RegistrationRow = {
  _id: string;
  _rev: number;
  reference: string;
  submittedAt: string;
  updatedAt: string;
  retainUntil: string;
  positionTypes: string[];
  opportunities: { reference: string; appliedAt: string }[];
  institutions: string[];
  expertise: string[];
  status: InterestStatus;
  statusHistory: StatusChange[];
  cvs: { fileId: string; name: string; size: number; uploadedAt: string }[];
  name: string;
  email: string;
  notes: { text: string; at: string }[];
};

export async function listRegistrations(opts: { institution?: string; positionType?: string; status?: string; opportunity?: string; page: number; pageSize: number }) {
  const db = database()!;
  const filter: Record<string, unknown> = {};
  if (opts.institution) filter.institutions = opts.institution;
  // Early registrations have no positionTypes and count as founding.
  if (opts.positionType === "founding") filter.$or = [{ positionTypes: "founding" }, { positionTypes: { $exists: false } }];
  else if (opts.positionType) filter.positionTypes = opts.positionType;
  if (opts.status) filter.status = opts.status;
  if (opts.opportunity) {
    // Applications for one position: matched here, since the database does not match fields of
    // objects inside arrays. The numbers are small (one record per person).
    const all = await registrations(db).find(filter, { sort: { submittedAt: -1 }, limit: 1000 });
    const matching = all.documents.filter((r) => r.opportunities?.some((o) => o.reference === opts.opportunity));
    const slice = matching.slice((opts.page - 1) * opts.pageSize, opts.page * opts.pageSize);
    const rows = await Promise.all(slice.map(async (r) => toRow(r, await decryptRegistration(db, r))));
    return { rows, total: matching.length, hasMore: opts.page * opts.pageSize < matching.length };
  }
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
  const [total, fresh, inProgress] = await Promise.all([
    registrations(db).count({}),
    registrations(db).count({ status: "new" }),
    registrations(db).count({ status: { $in: ["contacted", "shortlisted", "offered"] } }),
  ]);
  return { total, fresh, inProgress };
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
    opportunities: r.opportunities ?? [],
    institutions: r.institutions,
    expertise: r.expertise,
    status: r.status,
    statusHistory: r.statusHistory ?? [],
    cvs: r.cvs.map((c) => ({ fileId: c.fileId, name: c.name, size: c.size, uploadedAt: c.uploadedAt })),
    name: pii?.fullName ?? "(erased)",
    email: pii?.email ?? "",
    notes: pii?.notes ?? [],
  };
}
