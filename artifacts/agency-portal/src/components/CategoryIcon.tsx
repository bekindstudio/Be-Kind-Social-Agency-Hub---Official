import {
  Share2, Megaphone, Globe, ShoppingCart, Search, Target, Zap, Mail,
  PenTool, Video, Camera, Palette, Users, Newspaper, Compass,
  BarChart3, Settings, Smartphone, GraduationCap, Folder
} from "lucide-react";
import type { LucideProps } from "lucide-react";

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  "share-2": Share2,
  "megaphone": Megaphone,
  "globe": Globe,
  "shopping-cart": ShoppingCart,
  "search": Search,
  "target": Target,
  "zap": Zap,
  "mail": Mail,
  "pen-tool": PenTool,
  "video": Video,
  "camera": Camera,
  "palette": Palette,
  "users": Users,
  "newspaper": Newspaper,
  "compass": Compass,
  "bar-chart-3": BarChart3,
  "settings": Settings,
  "smartphone": Smartphone,
  "graduation-cap": GraduationCap,
  "folder": Folder,
};

export function CategoryIcon({ icon, size = 14, className }: { icon: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[icon] ?? Folder;
  return <Icon size={size} className={className} />;
}
