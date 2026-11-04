// The address book (wallet prompt 8): local, non-sensitive. Each entry is re-validated against
// the current network every time it is read, so a foreign or damaged entry is flagged, not used.

import { config } from "$lib/config";
import { addressProblem } from "$lib/stablechain/addresses/identifiers";
import { db, type Contact } from "$lib/storage/db";

class Contacts {
  list = $state.raw<Contact[]>([]);
  #loaded = false;

  async load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    try {
      this.list = (await db.all("contacts")).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      this.list = [];
    }
  }

  valid(contact: Contact): boolean {
    return contact.network === config.network && addressProblem(contact.address, config.network) === null;
  }

  byAddress(address: string): Contact | null {
    return this.list.find((c) => c.address === address && this.valid(c)) ?? null;
  }

  async save(input: { id?: string; name: string; address: string; note: string }): Promise<Contact> {
    const existing = input.id ? this.list.find((c) => c.id === input.id) : undefined;
    const contact: Contact = {
      id: existing?.id ?? crypto.randomUUID(),
      name: input.name.trim(),
      address: input.address.trim(),
      network: config.network,
      note: input.note.trim(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await db.put("contacts", contact);
    this.list = [...this.list.filter((c) => c.id !== contact.id), contact].sort((a, b) => a.name.localeCompare(b.name));
    return contact;
  }

  async remove(id: string): Promise<void> {
    await db.delete("contacts", id);
    this.list = this.list.filter((c) => c.id !== id);
  }
}

export const contacts = new Contacts();
