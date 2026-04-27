import { ProductStateCard } from "@/components/product/states/product-state-card";

export function EmptyStateCard(props: {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: {
    href: string;
    label: string;
  };
  secondaryAction?: {
    href: string;
    label: string;
  };
  badges?: string[];
  helperText?: string | null;
}) {
  return <ProductStateCard {...props} />;
}
