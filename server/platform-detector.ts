export type PlatformType = 
  | 'youtube'
  | 'spotify'
  | 'medium'
  | 'substack'
  | 'gitcoin'
  | 'giveth'
  | 'tiktok'
  | 'instagram'
  | 'twitter'
  | 'github'
  | 'farcaster'
  | 'twitch'
  | 'blog'
  | 'audio'
  | 'eventbrite'
  | 'luma'
  | 'meetup'
  | 'partiful';

export interface PlatformInfo {
  type: PlatformType;
  name: string;
  id?: string;
}

export function detectPlatform(url: string): PlatformInfo {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    // YouTube (videos, channels, and short URLs)
    if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
      const isVideo = pathname.includes('/watch') || hostname === 'youtu.be';
      const isShort = pathname.includes('/shorts/');
      const match = pathname.match(/\/(channel|c|user|@)\/([^\/]+)/);
      
      return {
        type: 'youtube',
        name: isVideo ? 'YouTube Video' : isShort ? 'YouTube Short' : 'YouTube',
        id: match ? match[2] : undefined
      };
    }

    // Spotify
    if (hostname.includes('spotify.com')) {
      const match = pathname.match(/\/(track|album|artist|playlist)\/([^\/\?]+)/);
      return {
        type: 'spotify',
        name: 'Spotify',
        id: match ? match[2] : undefined
      };
    }

    // Audio URL detection
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(url)) {
      return { type: 'audio', name: 'Audio File' };
    }

    // Medium
    if (hostname.includes('medium.com') || hostname.endsWith('.medium.com')) {
      return { type: 'medium', name: 'Medium' };
    }

    // Substack
    if (hostname.includes('substack.com')) {
      return { type: 'substack', name: 'Substack' };
    }

    // Gitcoin
    if (hostname.includes('gitcoin.co') || hostname.includes('grants.gitcoin.co')) {
      return { type: 'gitcoin', name: 'Gitcoin' };
    }

    // Giveth
    if (hostname.includes('giveth.io')) {
      return { type: 'giveth', name: 'Giveth' };
    }

    // TikTok (both profile and video URLs)
    if (hostname.includes('tiktok.com')) {
      const isVideo = pathname.includes('/video/');
      return { 
        type: 'tiktok', 
        name: isVideo ? 'TikTok Video' : 'TikTok' 
      };
    }

    // Instagram (both profile and post URLs)
    if (hostname.includes('instagram.com')) {
      const isPost = pathname.includes('/p/') || pathname.includes('/reel/') || pathname.includes('/tv/');
      return { 
        type: 'instagram', 
        name: isPost ? 'Instagram Post' : 'Instagram' 
      };
    }

    // Twitter/X (both profile and tweet URLs)
    if (hostname.includes('twitter.com') || hostname === 'x.com') {
      const isTweet = pathname.includes('/status/');
      return { 
        type: 'twitter', 
        name: isTweet ? 'Tweet' : 'Twitter/X' 
      };
    }

    // GitHub
    if (hostname.includes('github.com')) {
      return { type: 'github', name: 'GitHub' };
    }

    // Farcaster
    if (hostname.includes('warpcast.com') || hostname.includes('farcaster.xyz')) {
      return { type: 'farcaster', name: 'Farcaster' };
    }

    // Twitch
    if (hostname.includes('twitch.tv')) {
      return { type: 'twitch', name: 'Twitch' };
    }

    // Eventbrite
    if (hostname.includes('eventbrite.com') || hostname.includes('eventbrite.co')) {
      return { type: 'eventbrite', name: 'Eventbrite Event' };
    }

    // Luma (lu.ma)
    if (hostname.includes('lu.ma') || hostname.includes('luma.')) {
      return { type: 'luma', name: 'Luma Event' };
    }

    // Meetup
    if (hostname.includes('meetup.com')) {
      return { type: 'meetup', name: 'Meetup Event' };
    }

    // Partiful
    if (hostname.includes('partiful.com')) {
      return { type: 'partiful', name: 'Partiful Event' };
    }

    // Default to generic blog
    return { type: 'blog', name: 'Blog/Article' };

  } catch (error) {
    // If URL parsing fails, treat as a generic blog/article
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(url)) {
      return { type: 'audio', name: 'Audio File' };
    }
    return { type: 'blog', name: 'Blog/Article' };
  }
}

export const SUPPORTED_PLATFORMS = [
  { type: 'youtube', name: 'YouTube', example: 'https://youtube.com/@channelname' },
  { type: 'spotify', name: 'Spotify', example: 'https://open.spotify.com/track/...' },
  { type: 'audio', name: 'Audio File', example: 'https://example.com/audio.mp3' },
  { type: 'medium', name: 'Medium', example: 'https://medium.com/@author/article' },
  { type: 'substack', name: 'Substack', example: 'https://example.substack.com/p/article' },
  { type: 'gitcoin', name: 'Gitcoin Grants', example: 'https://grants.gitcoin.co/...' },
  { type: 'giveth', name: 'Giveth', example: 'https://giveth.io/project/...' },
  { type: 'tiktok', name: 'TikTok', example: 'https://tiktok.com/@username' },
  { type: 'instagram', name: 'Instagram', example: 'https://instagram.com/username' },
  { type: 'twitter', name: 'Twitter/X', example: 'https://twitter.com/username' },
  { type: 'github', name: 'GitHub', example: 'https://github.com/username/project' },
  { type: 'farcaster', name: 'Farcaster', example: 'https://warpcast.com/username' },
  { type: 'twitch', name: 'Twitch', example: 'https://twitch.tv/username' },
  { type: 'eventbrite', name: 'Eventbrite', example: 'https://eventbrite.com/e/event-name-12345' },
  { type: 'luma', name: 'Luma', example: 'https://lu.ma/event-name' },
  { type: 'meetup', name: 'Meetup', example: 'https://meetup.com/group-name/events/12345' },
  { type: 'partiful', name: 'Partiful', example: 'https://partiful.com/e/event-id' },
  { type: 'blog', name: 'Personal Blogs & News', example: 'https://example.com/article' },
] as const;