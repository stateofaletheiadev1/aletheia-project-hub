// All dates are formatted in UTC and say so where precision matters.
const long = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export const formatDateLong = (iso: string | Date) => long.format(new Date(iso));
export const formatDateShort = (iso: string | Date) => short.format(new Date(iso));
