import React from 'react';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Lightweight wrapper for Material icons used in the Stitch design system.
 * Maps Stitch's Material Symbols names to the closest @expo/vector-icons equivalents.
 */

// Map of Stitch Material Symbol names → @expo/vector-icons MaterialIcons names
const ICON_MAP: Record<string, { name: string; set: 'material' | 'community' }> = {
  // Navigation
  'arrow_back': { name: 'arrow-back', set: 'material' },
  'chevron_right': { name: 'chevron-right', set: 'material' },
  // Welcome screen floating cards
  'mail': { name: 'mail', set: 'material' },
  'calendar_today': { name: 'calendar-today', set: 'material' },
  'description': { name: 'description', set: 'material' },
  'account_balance_wallet': { name: 'account-balance-wallet', set: 'material' },
  // Settings & Integrations
  'edit': { name: 'edit', set: 'material' },
  'shield': { name: 'security', set: 'material' },
  'security': { name: 'security', set: 'material' },
  'link': { name: 'link', set: 'material' },
  'help': { name: 'help-outline', set: 'material' },
  'info': { name: 'info-outline', set: 'material' },
  'lock': { name: 'lock', set: 'material' },
  'folder': { name: 'folder', set: 'material' },
  'badge': { name: 'badge', set: 'material' },
  'account_balance': { name: 'account-balance', set: 'material' },
  'bar_chart': { name: 'bar-chart', set: 'material' },
  // Bento card icons
  'insights': { name: 'insights', set: 'material' },
  'history_edu': { name: 'history-edu', set: 'material' },
  // Orb icon
  'blur_on': { name: 'blur-on', set: 'material' },
  // CTA arrow
  'arrow_forward': { name: 'arrow-forward', set: 'material' },
};

interface StitchIconProps {
  name: string;
  size?: number;
  color?: string;
}

export default function StitchIcon({ name, size = 24, color = '#6b38d4' }: StitchIconProps) {
  const mapped = ICON_MAP[name];
  
  if (!mapped) {
    // Fallback: try using MaterialIcons directly
    return <MaterialIcons name={name as any} size={size} color={color} />;
  }

  if (mapped.set === 'community') {
    return <MaterialCommunityIcons name={mapped.name as any} size={size} color={color} />;
  }

  return <MaterialIcons name={mapped.name as any} size={size} color={color} />;
}
