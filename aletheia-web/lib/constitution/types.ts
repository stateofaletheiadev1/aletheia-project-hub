/**
 * Source model for the draft Constitution. Text is written with symbolic cross-references:
 *   [[key]]      → "Article 42"
 *   [[key(3)]]   → "Article 42(3)"
 *   [[S3]]       → "Schedule 3"
 * Numbers are assigned in document order when the text is assembled (lib/constitution/index.ts),
 * so articles can be added or moved without breaking references; an unknown key fails the build.
 */

/** A clause: plain text, or a lead-in followed by lettered items (a), (b), … */
export type ClauseSource = string | [string, string[]];

export interface ArticleSource {
  key: string;
  title: string;
  clauses: ClauseSource[];
}

export interface ChapterSource {
  title: string;
  articles: ArticleSource[];
}

export interface PartSource {
  /** Roman numeral. */
  numeral: string;
  title: string;
  chapters: ChapterSource[];
}

export interface ScheduleSource {
  number: number;
  title: string;
  /** Articles the schedule gives effect to. */
  basis: string[];
  sections: { heading: string; clauses: ClauseSource[] }[];
}

export function art(key: string, title: string, clauses: ClauseSource[]): ArticleSource {
  return { key, title, clauses };
}

export function chapter(title: string, ...articles: ArticleSource[]): ChapterSource {
  return { title, articles };
}
