import type { ElementType } from "react";
import {
  Brain, BookOpen, Calculator, Ruler, Pencil, GraduationCap,
  Globe, Monitor, Music, Lightbulb, BarChart2, Target, Trophy,
  Star, Rocket, Key, Gem, Hash, Cpu, Microscope, Palette,
  TestTube, Landmark, Layers,
} from "lucide-react";

export interface TutorIconEntry {
  id: string;
  Icon: ElementType;
  label: string;
}

export const TUTOR_ICONS: TutorIconEntry[] = [
  { id: "Brain",         Icon: Brain,         label: "Brain" },
  { id: "BookOpen",      Icon: BookOpen,      label: "Book" },
  { id: "GraduationCap", Icon: GraduationCap, label: "Exam" },
  { id: "Calculator",    Icon: Calculator,    label: "Maths" },
  { id: "Microscope",    Icon: Microscope,    label: "Science" },
  { id: "TestTube",      Icon: TestTube,      label: "Chemistry" },
  { id: "Palette",       Icon: Palette,       label: "Art" },
  { id: "Music",         Icon: Music,         label: "Music" },
  { id: "Globe",         Icon: Globe,         label: "Geography" },
  { id: "Monitor",       Icon: Monitor,       label: "Computing" },
  { id: "Cpu",           Icon: Cpu,           label: "Technology" },
  { id: "Lightbulb",     Icon: Lightbulb,     label: "Ideas" },
  { id: "Layers",        Icon: Layers,        label: "Topics" },
  { id: "BarChart2",     Icon: BarChart2,     label: "Statistics" },
  { id: "Landmark",      Icon: Landmark,      label: "History" },
  { id: "Ruler",         Icon: Ruler,         label: "Geometry" },
  { id: "Pencil",        Icon: Pencil,        label: "Writing" },
  { id: "Target",        Icon: Target,        label: "Goals" },
  { id: "Trophy",        Icon: Trophy,        label: "Achievement" },
  { id: "Star",          Icon: Star,          label: "Excellence" },
  { id: "Rocket",        Icon: Rocket,        label: "Physics" },
  { id: "Key",           Icon: Key,           label: "Key Concepts" },
  { id: "Gem",           Icon: Gem,           label: "Premium" },
  { id: "Hash",          Icon: Hash,          label: "Numbers" },
];

// Render a single tutor icon by ID

interface TutorIconProps {
  iconId?: string | null;
  size?: number;
  className?: string;
  /** Fallback character if iconId is not recognised (e.g. subject initial) */
  fallbackChar?: string;
}

export function TutorIcon({ iconId, size = 20, className = "", fallbackChar }: TutorIconProps) {
  const entry = TUTOR_ICONS.find(i => i.id === iconId);
  if (!entry) {
    if (fallbackChar) {
      return <span className={`font-bold text-sm select-none ${className}`}>{fallbackChar}</span>;
    }
    // Default fallback
    return <Brain size={size} className={className} />;
  }
  const { Icon } = entry;
  return <Icon size={size} className={className} />;
}

// Icon picker grid (used in Settings tab)

interface PickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function TutorIconPicker({ value, onChange }: PickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TUTOR_ICONS.map(({ id, Icon, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => onChange(value === id ? "" : id)}
          className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${
            value === id
              ? "border-purple-400 bg-purple-50 text-purple-700 shadow-sm"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
          }`}
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}
