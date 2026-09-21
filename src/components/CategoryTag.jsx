import { Zap, Construction, Droplets, Trash2, Lightbulb, HelpCircle } from "lucide-react";

export const CATEGORY_META = {
  electricity: { icon: Zap, label: "Electricity", cls: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30" },
  roads: { icon: Construction, label: "Roads", cls: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
  water: { icon: Droplets, label: "Water", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  sanitation: { icon: Trash2, label: "Sanitation", cls: "bg-lime-500/10 text-lime-300 border-lime-500/30" },
  streetlights: { icon: Lightbulb, label: "Streetlights", cls: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
  other: { icon: HelpCircle, label: "Other", cls: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
};

export const CATEGORIES = Object.keys(CATEGORY_META);

export default function CategoryTag({ category }) {
  const c = CATEGORY_META[category] || CATEGORY_META.other;
  const Icon = c.icon;
  return (
    <span data-testid={`category-tag-${category}`} className={`chip ${c.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}
