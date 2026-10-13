import { fail, json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { documents, documentView, MAX_UPLOAD_BYTES, SUBMITTED_TYPES, uploadDocument, type SubmittedType } from '@/lib/server/documents';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  const { documents: list } = await documents().find({ accountId: account._id }, { sort: { createdAt: -1 }, limit: 200 });
  return json({ documents: await Promise.all(list.map(documentView)) });
});

/** Multipart upload: fields `file` and `docType`. */
export const POST = route(async (req) => {
  const { account } = await requireAccount(req);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) fail(413, 'The file is larger than 4 MB.');
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'Send the document as a form upload.');
  }
  const file = form.get('file');
  const docType = form.get('docType');
  if (!(file instanceof File)) return fail(400, 'Choose a file to upload.');
  if (typeof docType !== 'string' || !SUBMITTED_TYPES.includes(docType as SubmittedType)) return fail(400, 'Choose what kind of document this is.');
  const doc = await uploadDocument(account, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, docType as SubmittedType);
  return json({ document: await documentView(doc) }, 201);
});
