
// Username generator for email-only users (no wallet)
export function generateUsernameFromEmail(email: string): string {
  // Extract prefix from email (before @)
  const emailPrefix = email.split('@')[0].toLowerCase();
  
  // Clean the prefix (remove special chars, keep alphanumeric)
  const cleanPrefix = emailPrefix.replace(/[^a-z0-9]/g, '').slice(0, 12);
  
  // Use "every1" as suffix (from Every1.fun platform name)
  const platformSuffix = 'every1';
  
  return `${cleanPrefix}-${platformSuffix}`;
}

export function generateCreativeUsername(): string {
  const adjectives = [
    'cosmic', 'creative', 'digital', 'bright', 'swift',
    'bold', 'clever', 'dynamic', 'epic', 'fresh',
    'vibrant', 'stellar', 'radiant', 'zealous', 'nimble',
    'mystic', 'quantum', 'electric', 'lunar', 'solar'
  ];
  
  const nouns = [
    'creator', 'dreamer', 'artist', 'builder', 'maker',
    'pioneer', 'explorer', 'visionary', 'innovator', 'star',
    'spark', 'wave', 'flame', 'pulse', 'echo',
    'journey', 'horizon', 'nexus', 'forge', 'vault'
  ];
  
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 999);
  
  return `${randomAdj}-${randomNoun}${randomNum}`;
}

export function generatePlatformUsername(): string {
  const timestamp = Date.now().toString(36).slice(-6);
  return `every1-${timestamp}`;
}

export function getDefaultUsername(email?: string, privyId?: string): string {
  // Priority 1: Email-based username
  if (email) {
    return generateUsernameFromEmail(email);
  }
  
  // Priority 2: Creative username
  if (Math.random() > 0.5) {
    return generateCreativeUsername();
  }
  
  // Priority 3: Platform username with unique ID
  const uniqueId = privyId ? privyId.slice(-6) : Date.now().toString(36).slice(-6);
  return `every1-${uniqueId}`;
}
