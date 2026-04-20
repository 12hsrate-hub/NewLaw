type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionTitle({ eyebrow, title, description }: SectionTitleProps) {
  return (
    <header className="space-y-4 text-center md:text-left">
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{eyebrow}</p>
      <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">{title}</h1>
      <p className="max-w-2xl text-base leading-7 text-[var(--muted)] md:text-lg">{description}</p>
    </header>
  );
}
