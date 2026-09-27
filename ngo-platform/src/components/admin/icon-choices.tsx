"use client";

import {
  Baby, BookOpen, Bot, Building2, CalendarCheck, Cpu, Droplets, Factory, Flame, GraduationCap, HandHeart,
  HeartHandshake, HeartPulse, House, Landmark, LayoutGrid, Leaf, Mountain, Recycle, Scale, Shield, Sprout,
  Stethoscope, Sun, Target, TreePine, Tractor, Users, Utensils, Wheat, Wind, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Curated set (importing lucide's full map would bloat the admin bundle).
// Names are stored in the DB in kebab-case and rendered publicly via components/public/icon.
export const ICON_CHOICES = {
  sprout: Sprout, wheat: Wheat, tractor: Tractor, "tree-pine": TreePine, leaf: Leaf, recycle: Recycle,
  droplets: Droplets, sun: Sun, wind: Wind, zap: Zap, flame: Flame, mountain: Mountain, house: House,
  "building-2": Building2, landmark: Landmark, factory: Factory, users: Users, baby: Baby,
  "heart-handshake": HeartHandshake, "hand-heart": HandHeart, "heart-pulse": HeartPulse,
  stethoscope: Stethoscope, "graduation-cap": GraduationCap, "book-open": BookOpen, cpu: Cpu, bot: Bot,
  scale: Scale, shield: Shield, utensils: Utensils, target: Target, "calendar-check": CalendarCheck,
  "layout-grid": LayoutGrid,
} as const;

export function IconPicker({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-11">
        {Object.entries(ICON_CHOICES).map(([name, Icon]) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={value === name}
            title={name}
            onClick={() => onChange(value === name ? null : name)}
            className={cn("grid aspect-square place-items-center rounded-theme border", value === name ? "border-primary bg-primary/10 text-primary" : "border-foreground/10 hover:bg-foreground/5")}
          >
            <Icon aria-hidden className="size-5" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function IconPreview({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICON_CHOICES[name as keyof typeof ICON_CHOICES]) || LayoutGrid;
  return <Icon aria-hidden className={className} />;
}
