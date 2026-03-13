export type PlatformCategory = 
  | 'gitcoin'
  | 'youtube'
  | 'behance'
  | 'github'
  | 'twitter'
  | 'farcaster'
  | 'lens'
  | 'discord'
  | 'telegram'
  | 'devpost'
  | 'dribbble'
  | 'medium'
  | 'other';

export interface PlatformInfo {
  category: PlatformCategory;
  icon: string;
  color: string;
}

export const PLATFORM_CONFIGS: Record<PlatformCategory, PlatformInfo> = {
  gitcoin: {
    category: 'gitcoin',
    icon: '🎯',
    color: '#0E76FD'
  },
  youtube: {
    category: 'youtube',
    icon: '▶️',
    color: '#FF0000'
  },
  behance: {
    category: 'behance',
    icon: '🎨',
    color: '#053EFF'
  },
  github: {
    category: 'github',
    icon: '💻',
    color: '#171515'
  },
  twitter: {
    category: 'twitter',
    icon: '🐦',
    color: '#1DA1F2'
  },
  farcaster: {
    category: 'farcaster',
    icon: '📡',
    color: '#855DCD'
  },
  lens: {
    category: 'lens',
    icon: '🌿',
    color: '#00501E'
  },
  discord: {
    category: 'discord',
    icon: '💬',
    color: '#5865F2'
  },
  telegram: {
    category: 'telegram',
    icon: '📬',
    color: '#26A5E4'
  },
  devpost: {
    category: 'devpost',
    icon: '🚀',
    color: '#003E54'
  },
  dribbble: {
    category: 'dribbble',
    icon: '🏀',
    color: '#EA4C89'
  },
  medium: {
    category: 'medium',
    icon: '📝',
    color: '#000000'
  },
  other: {
    category: 'other',
    icon: '🔗',
    color: '#6B7280'
  }
};