# OPEN QUESTIONS & CONFLICT LOG
**The Sovereign Covenant State of Aletheia — Engineering Platform**  
*Document Version: 1.0.0 (Phase 0)*  
*Rule: When two sources conflict, resolve per §0.3 precedence and log here.*

---

## 1. Resolved Precedence Decisions

| Item ID | Topic | Source A (Lower) | Source B (Higher) | Resolution Adopted |
|---|---|---|---|---|
| **RES-001** | **ADSS Directorate Structure** | Blueprint Chapter 11 describes "Commands" (Land & Civil, Naval & Coast Guard, Air & Aerospace) | Master Engineering Prompt §13–15 specifies explicit **Directorates** (Army, Navy, Air Force, Police, Immigration, Intelligence, Cybersecurity Department, Civil Protection) | **Adopt Prompt Directorates.** Police is strictly separated from military functions; Cybersecurity is a mandatory standalone national department. |
| **RES-002** | **National Flag vs Ensign** | Flag A and Flag B both uploaded | Blueprint §3.3 states Option A is recommended National Flag, Option B is State/Civil Ensign | **Adopt Flag A as National Flag** and **Flag B as State & Maritime Ensign**. Both are officially documented in the National Symbols registry. |
| **RES-003** | **Currency Unit Naming** | Blueprint uses `ALUSD` and `ALnT` | Master Prompt §29 explicitly requires `/aey` currency section | **Harmonized Architecture:** `AEY` is the sovereign European-aligned sovereign unit of account (redeemable for EUR); `ALUSD` and `ALnT` represent the underlying settlement and validator tokens on the StableChain protocol. |
| **RES-004** | **Color Palette Authority** | Generic web defaults | Uploaded PNGs (`coat_of_arms.png`, `flag_a.png`, `flag_b.png`) sampled pixel values | Exact sampled Hex values adopted as canonical CSS custom properties: Covenant Navy `#15294A`, Ledger Parchment `#F4EEDF`, Seal Gold `#C49A4E`, Laurel Green `#2F6B4F`, Covenant Burgundy `#701824`. |

---

## 2. Pending Product Owner Directives

| Question ID | Component | Question | Recommended Option | Status |
|---|---|---|---|---|
| **Q-001** | Flag Adoption | Should Flag A (Nordic Cross) be the primary header emblem, or should the Coat of Arms serve as the primary institutional header mark? | **Recommended:** Use the Quartered Coat of Arms (or Hexagonal Star emblem) for institutional/government headers, and Flag A for national sovereignty banners and passports. | Ready for Confirmation |
| **Q-002** | Initial Launch Scope | Should Phase 1 include the live interactive `/design-system` preview and public shell immediately? | **Recommended:** Yes, scaffold Next.js App Router with Tailwind design tokens and render `/design-system` with the full extracted palette and components. | Proceeding |
