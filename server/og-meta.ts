
import type { User, Coin, Project } from "@shared/schema";

export interface OGMetaData {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
}

export function generateProfileOGMeta(user: User, baseUrl: string): OGMetaData {
  return {
    title: `${user.displayName || user.username} | Every1.fun`,
    description: `${user.bio || `Check out ${user.displayName || user.username}'s profile on Every1.fun`} • ${user.e1xpPoints || 0} E1XP Points`,
    image: user.avatarUrl || `${baseUrl}/api/og/profile/${user.id}`,
    url: `${baseUrl}/profile/${user.id}`,
    type: "profile",
  };
}

export function generateCoinOGMeta(coin: Coin, baseUrl: string): OGMetaData {
  return {
    title: `${coin.name} (${coin.symbol}) | Every1.fun`,
    description: coin.description || `Trade ${coin.symbol} on Every1.fun - Creator Coins Platform`,
    image: coin.image || `${baseUrl}/api/og/coin/${coin.id}`,
    url: `${baseUrl}/coin/${coin.id}`,
    type: "website",
  };
}

export function generateProjectOGMeta(project: Project, baseUrl: string): OGMetaData {
  return {
    title: `${project.title} | Every1.fun`,
    description: project.description || `Check out this amazing project on Every1.fun`,
    image: project.thumbnailUrl || `${baseUrl}/api/og/project/${project.id}`,
    url: `${baseUrl}/project/${project.id}`,
    type: "website",
  };
}

export function generateReferralOGMeta(user: User, baseUrl: string): OGMetaData {
  return {
    title: `Join Every1.fun with ${user.displayName || user.username}`,
    description: `Get started on Every1.fun and earn bonus E1XP points! Use code: ${user.referralCode}`,
    image: user.avatarUrl || `${baseUrl}/api/og/referral/${user.referralCode}`,
    url: `${baseUrl}/join/${user.referralCode}`,
    type: "website",
  };
}

export function generateBadgeOGMeta(user: User, badgeName: string, baseUrl: string): OGMetaData {
  return {
    title: `${user.displayName || user.username} unlocked ${badgeName}! | Every1.fun`,
    description: `Check out my ${badgeName} badge on Every1.fun! Total E1XP: ${user.e1xpPoints || 0}`,
    image: `${baseUrl}/api/og/badge/${user.id}/${badgeName}`,
    url: `${baseUrl}/profile/${user.id}`,
    type: "website",
  };
}

export function generateOGMetaTags(meta: OGMetaData): string {
  return `
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.description}" />
    <meta property="og:image" content="${meta.image}" />
    <meta property="og:url" content="${meta.url}" />
    <meta property="og:type" content="${meta.type}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.description}" />
    <meta name="twitter:image" content="${meta.image}" />
  `.trim();
}
