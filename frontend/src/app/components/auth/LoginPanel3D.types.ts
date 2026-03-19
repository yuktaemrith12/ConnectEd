export type Role = 'student' | 'teacher' | 'parent' | 'admin';

export interface RoleConfig {
  primaryColor: string;
  emissiveColor: string;
  lightColor: number;
  particleColor: number;
  label: string;
  tagline: string;
  gradient: string;
}

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  student: {
    primaryColor: '#3B82F6',
    emissiveColor: '#1D4ED8',
    lightColor: 0x3B82F6,
    particleColor: 0x93C5FD,
    label: 'Student Portal',
    tagline: "Where homework meets hope, and deadlines become... guidelines?",
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  },
  teacher: {
    primaryColor: '#8B5CF6',
    emissiveColor: '#4C1D95',
    lightColor: 0x8B5CF6,
    particleColor: 0xC4B5FD,
    label: 'Teacher Portal',
    tagline: "Coffee-powered, grade-ready, and only slightly caffeinated",
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
  },
  parent: {
    primaryColor: '#10B981',
    emissiveColor: '#065F46',
    lightColor: 0x10B981,
    particleColor: 0x6EE7B7,
    label: 'Parent Portal',
    tagline: "Because 'How was school?' deserves a better answer",
    gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  },
  admin: {
    primaryColor: '#F97316',
    emissiveColor: '#C2410C',
    lightColor: 0xF97316,
    particleColor: 0xFDBA74,
    label: 'Admin Portal',
    tagline: "The one dashboard to rule them all. You're in charge now",
    gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
  },
};

export interface FloatConfig {
  phaseOffset: number;
  amplitude: number;
  floatSpeed: number;
  rotSpeed: { x: number; y: number; z: number };
  baseY: number;
}
