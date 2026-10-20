/**
 * Visible marker for information the founder still has to provide. The text stays in
 * English and is never translated, so it is easy to find and replace.
 */
export function Placeholder({ children, block = false }: { children: string; block?: boolean }) {
  const Tag = block ? 'p' : 'span';
  return (
    <Tag
      translate="no"
      data-i18n-skip=""
      className={`${block ? 'block' : 'inline'} font-mono text-[12px] leading-relaxed text-[#8F5800] bg-[#FDF6E2] border border-dashed border-[#ECC974] rounded-sm px-2 py-1`}
    >
      {`[[FOUNDER TO PROVIDE: ${children}]]`}
    </Tag>
  );
}
