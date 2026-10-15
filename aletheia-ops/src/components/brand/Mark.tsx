// The inescutcheon from the State arms (as on aletheiagov.org): a hexagon bearing a cross.
// Used at small sizes in the masthead, where the full arms would lose detail.
export function Mark({ size = 22, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.15)}
      viewBox="0 0 100 115"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <polygon points="50,2 96,28 96,87 50,113 4,87 4,28" fill="#15294A" stroke="#C49A4E" strokeWidth="5" />
      <polygon points="50,11 88,32.5 88,82.5 50,104 12,82.5 12,32.5" fill="none" stroke="#C49A4E" strokeWidth="1.6" />
      <path d="M45 30h10v16h15v10H55v30H45V56H30V46h15z" fill="#F4EEDF" />
    </svg>
  );
}
