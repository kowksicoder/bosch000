import axios from "axios";
import * as cheerio from "cheerio";
import { type PlatformType } from "./platform-detector";

export interface ScrapedData {
  url: string;
  platform: PlatformType;
  title: string;
  description?: string;
  author?: string;
  publishDate?: string;
  image?: string;
  animation_url?: string;
  type?: string;
  content?: string;
  tags?: string[];
  followers?: number;
  engagement?: number;
}

const ENSEMBLE_API_KEY = "7eAd2jIty0ouYF7q";
const ENSEMBLE_BASE_URL = "https://ensembledata.com/apis";

// Instagram - using EnsembleData API (supports both profiles and posts)
async function scrapeInstagramOembed(url: string): Promise<ScrapedData> {
  try {
    // Check if it's a post URL
    const postMatch = url.match(/instagram\.com\/(p|reel|tv)\/([^\/\?]+)/);
    
    if (postMatch) {
      // Scrape post
      const shortcode = postMatch[2];

      const postInfoUrl = `${ENSEMBLE_BASE_URL}/ig/post/info`;
      const response = await axios.get(postInfoUrl, {
        params: {
          shortcode,
          token: ENSEMBLE_API_KEY,
        },
        timeout: 15000,
      });

      const postData = response.data?.data;
      if (!postData) throw new Error('No post data found');

      const post = postData.items?.[0] || postData;
      const owner = post.owner || post.user || {};

      return {
        url,
        platform: 'instagram',
        title: `Instagram Post by @${owner.username || 'user'}`,
        author: owner.full_name || owner.username || 'Instagram User',
        description: post.caption?.text || post.edge_media_to_caption?.edges?.[0]?.node?.text || 'Instagram post',
        image: post.display_url || post.thumbnail_url || post.image_versions2?.candidates?.[0]?.url || '',
        content: post.caption?.text || post.edge_media_to_caption?.edges?.[0]?.node?.text || '',
        followers: post.like_count || post.edge_media_preview_like?.count || 0,
        engagement: post.comment_count || post.edge_media_to_comment?.count || 0,
      };
    }

    // Extract username from profile URL
    const usernameMatch = url.match(/instagram\.com\/([^\/\?]+)/);
    if (!usernameMatch) throw new Error('Invalid Instagram URL');

    const username = usernameMatch[1];

    // Get user info using EnsembleData
    const userInfoUrl = `${ENSEMBLE_BASE_URL}/ig/user/info`;
    const response = await axios.get(userInfoUrl, {
      params: {
        username,
        token: ENSEMBLE_API_KEY,
      },
      timeout: 15000,
    });

    const userData = response.data?.data;
    if (!userData) throw new Error('No user data found');

    return {
      url,
      platform: 'instagram',
      title: `Instagram - @${username}`,
      author: userData.full_name || username,
      description: userData.biography || `Instagram profile for @${username}`,
      image: userData.profile_pic_url || '',
      content: userData.biography || '',
      followers: userData.follower_count || 0,
      engagement: userData.media_count || 0,
    };
  } catch (error) {
    console.error('Instagram scraping error:', error);
    const username = url.match(/instagram\.com\/([^\/\?]+)/)?.[1] || 'user';
    return {
      url,
      platform: 'instagram',
      title: `Instagram - @${username}`,
      author: username,
      description: `Instagram profile for @${username}`,
      content: `Profile for @${username}`,
      followers: 0,
    };
  }
}

// TikTok - using EnsembleData API (supports both profiles and videos)
async function scrapeTikTokOembed(url: string): Promise<ScrapedData> {
  try {
    // Check if it's a video URL
    const videoMatch = url.match(/tiktok\.com\/@([^\/\?]+)\/video\/(\d+)/);
    
    if (videoMatch) {
      // Scrape video
      const username = videoMatch[1];
      const videoId = videoMatch[2];

      const videoInfoUrl = `${ENSEMBLE_BASE_URL}/tt/post/info`;
      const response = await axios.get(videoInfoUrl, {
        params: {
          link: url,
          token: ENSEMBLE_API_KEY,
        },
        timeout: 15000,
      });

      const videoData = response.data?.data;
      if (!videoData) throw new Error('No video data found');

      const video = videoData.video || videoData.itemInfo?.itemStruct || videoData;
      const author = video.author || videoData.author || {};
      const stats = video.stats || videoData.stats || {};

      // Extract video URL for playback
      const videoUrl = video.video?.downloadAddr || 
                      video.video?.playAddr || 
                      video.downloadAddr ||
                      video.playAddr ||
                      '';

      return {
        url,
        platform: 'tiktok',
        title: video.desc || video.title || `TikTok Video by @${username}`,
        author: author.nickname || author.uniqueId || username,
        description: video.desc || `TikTok video by @${username}`,
        image: video.video?.cover || video.cover || author.avatarLarger || '',
        animation_url: videoUrl,
        type: 'video',
        content: video.desc || '',
        followers: stats.diggCount || stats.playCount || 0,
        engagement: stats.shareCount || stats.commentCount || 0,
      };
    }

    // Extract username from profile URL
    const usernameMatch = url.match(/tiktok\.com\/@([^\/\?]+)/);
    if (!usernameMatch) throw new Error('Invalid TikTok URL');

    const username = usernameMatch[1];

    // Get user info using EnsembleData
    const userInfoUrl = `${ENSEMBLE_BASE_URL}/tt/user/info`;
    const response = await axios.get(userInfoUrl, {
      params: {
        username,
        token: ENSEMBLE_API_KEY,
      },
      timeout: 15000,
    });

    const userData = response.data?.data;
    if (!userData) throw new Error('No user data found');

    const user = userData.user || userData.userInfo || userData;
    const stats = userData.stats || userData.userInfo?.stats || user.stats || {};

    const followerCount = stats.followerCount || stats.follower_count || user.followerCount || user.follower_count || 0;
    const videoCount = stats.videoCount || stats.video_count || user.videoCount || user.video_count || 0;

    // Get the best available avatar image
    const avatarImage = user.avatarLarger || 
                       user.avatarMedium || 
                       user.avatar_larger?.url_list?.[0] || 
                       user.avatar_medium?.url_list?.[0] ||
                       user.avatar_thumb?.url_list?.[0] || 
                       user.avatarThumb || 
                       '';

    console.log('TikTok profile image URL:', avatarImage);

    return {
      url,
      platform: 'tiktok',
      title: `TikTok - @${username}`,
      author: user.nickname || user.uniqueId || username,
      description: user.signature || user.bio || `TikTok profile for @${username}`,
      image: avatarImage,
      content: user.signature || user.bio || '',
      followers: followerCount,
      engagement: videoCount,
      type: 'profile', // Explicitly mark as profile to avoid video rendering
    };
  } catch (error) {
    console.error('TikTok scraping error:', error);
    const username = url.match(/tiktok\.com\/@([^\/\?]+)/)?.[1] || 'user';
    return {
      url,
      platform: 'tiktok',
      title: `TikTok - @${username}`,
      author: username,
      description: `TikTok profile for @${username}`,
      content: `Profile for @${username}`,
      followers: 0,
      type: 'profile',
    };
  }
}

// YouTube - using EnsembleData API (supports videos, shorts, and channels)
async function scrapeYouTube(url: string): Promise<ScrapedData> {
  try {
    // Extract video ID from various YouTube URL formats
    let videoId: string | null = null;
    
    // Standard watch URL
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) videoId = watchMatch[1];
    
    // Short URL (youtu.be)
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    if (shortMatch) videoId = shortMatch[1];
    
    // Shorts URL
    const shortsMatch = url.match(/youtube\.com\/shorts\/([^?]+)/);
    if (shortsMatch) videoId = shortsMatch[1];

    // If it's a video URL, scrape video info
    if (videoId) {
      const videoInfoUrl = `${ENSEMBLE_BASE_URL}/yt/video/info`;
      const response = await axios.get(videoInfoUrl, {
        params: {
          id: videoId,
          token: ENSEMBLE_API_KEY,
        },
        timeout: 15000,
      });

      const videoData = response.data?.data;
      if (!videoData) throw new Error('No video data found');

      const video = videoData.videoDetails || videoData;
      const snippet = videoData.snippet || video;

      return {
        url,
        platform: 'youtube',
        title: video.title || snippet.title || 'YouTube Video',
        author: video.author || snippet.channelTitle || video.ownerChannelName || '',
        description: video.shortDescription || snippet.description || video.description || '',
        image: video.thumbnail?.thumbnails?.[0]?.url || snippet.thumbnails?.high?.url || '',
        content: video.shortDescription || snippet.description || '',
        followers: parseInt(video.viewCount || snippet.statistics?.viewCount || '0'),
        engagement: parseInt(video.likeCount || snippet.statistics?.likeCount || '0'),
      };
    }

    // Extract channel ID or username from URL
    const channelMatch = url.match(/youtube\.com\/(channel\/|@|c\/)([^\/\?]+)/);
    if (!channelMatch) {
      // Fallback to oEmbed for unknown formats
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await axios.get(oembedUrl, { timeout: 10000 });
      return {
        url,
        platform: 'youtube',
        title: response.data.title || 'YouTube Video',
        author: response.data.author_name || '',
        image: response.data.thumbnail_url || '',
        description: `YouTube video by ${response.data.author_name}`,
        content: response.data.title || '',
      };
    }

    const channelId = channelMatch[2];

    // Get channel info using EnsembleData
    const channelInfoUrl = `${ENSEMBLE_BASE_URL}/yt/channel/info`;
    const response = await axios.get(channelInfoUrl, {
      params: {
        id: channelId,
        token: ENSEMBLE_API_KEY,
      },
      timeout: 15000,
    });

    const channelData = response.data?.data;
    if (!channelData) throw new Error('No channel data found');

    return {
      url,
      platform: 'youtube',
      title: channelData.title || `YouTube - ${channelId}`,
      author: channelData.title || channelId,
      description: channelData.description || `YouTube channel ${channelId}`,
      image: channelData.avatar?.[0]?.url || '',
      content: channelData.description || '',
      followers: channelData.stats?.subscriberCount || 0,
      engagement: channelData.stats?.videoCount || 0,
    };
  } catch (error) {
    console.error('YouTube scraping error:', error);
    // Fallback to HTML scraping
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 30000,
      });
      const $ = cheerio.load(response.data);

      const title = $('meta[property="og:title"]').attr('content') || 'YouTube Content';
      const description = $('meta[property="og:description"]').attr('content') || '';
      const author = $('link[itemprop="name"]').attr('content') || '';
      const image = $('meta[property="og:image"]').attr('content') || '';

      return { url, platform: 'youtube', title, description, author, image, content: description };
    } catch (fallbackError) {
      return {
        url,
        platform: 'youtube',
        title: 'YouTube Content',
        description: 'Unable to fetch details',
        content: '',
      };
    }
  }
}

// Twitter/X - using EnsembleData API (supports both profiles and tweets)
async function scrapeTwitterNitter(url: string): Promise<ScrapedData> {
  try {
    // Check if it's a tweet URL
    const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)\/status\/(\d+)/);
    
    if (tweetMatch) {
      // Scrape tweet
      const username = tweetMatch[1];
      const tweetId = tweetMatch[2];

      const tweetInfoUrl = `${ENSEMBLE_BASE_URL}/twitter/tweet/info`;
      const response = await axios.get(tweetInfoUrl, {
        params: {
          id: tweetId,
          token: ENSEMBLE_API_KEY,
        },
        timeout: 15000,
      });

      const tweetData = response.data?.data;
      if (!tweetData) throw new Error('No tweet data found');

      const tweet = tweetData.tweet || tweetData;
      const user = tweet.user || tweet.core?.user_results?.result?.legacy || {};

      return {
        url,
        platform: 'twitter',
        title: `Tweet by @${user.screen_name || username}`,
        author: user.name || user.screen_name || username,
        description: tweet.full_text || tweet.text || 'Twitter post',
        image: tweet.entities?.media?.[0]?.media_url_https || user.profile_image_url_https || '',
        content: tweet.full_text || tweet.text || '',
        followers: tweet.favorite_count || tweet.public_metrics?.like_count || 0,
        engagement: tweet.retweet_count || tweet.public_metrics?.retweet_count || 0,
      };
    }

    // Extract username from profile URL
    const usernameMatch = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
    if (!usernameMatch) throw new Error('Invalid Twitter URL');

    const username = usernameMatch[1];

    // Get user info using EnsembleData
    const userInfoUrl = `${ENSEMBLE_BASE_URL}/twitter/user/info`;
    const response = await axios.get(userInfoUrl, {
      params: {
        username,
        token: ENSEMBLE_API_KEY,
      },
      timeout: 15000,
    });

    const userData = response.data?.data;
    if (!userData) throw new Error('No user data found');

    return {
      url,
      platform: 'twitter',
      title: userData.name || `Twitter/X - @${username}`,
      author: username,
      description: userData.description || `Twitter profile for @${username}`,
      image: userData.profile_image_url_https || '',
      content: userData.description || '',
      followers: userData.followers_count || 0,
      engagement: userData.statuses_count || 0,
    };
  } catch (error) {
    console.error('Twitter scraping error:', error);
    const username = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/)?.[1] || 'user';
    return {
      url,
      platform: 'twitter',
      title: `Twitter/X - @${username}`,
      author: username,
      description: `Twitter profile for @${username}`,
      content: `Profile for @${username}`,
      followers: 0,
    };
  }
}

async function scrapeSpotify(url: string): Promise<ScrapedData> {
  try {
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);

    // Try multiple selectors for Spotify metadata
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="twitter:title"]').attr('content') || 
                  $('meta[property="twitter:title"]').attr('content') ||
                  $('title').text().replace(' - Spotify', '').trim() || 
                  'Spotify Content';
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="twitter:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || 
                       $('meta[property="twitter:description"]').attr('content') ||
                       '';
    
    const author = $('meta[name="music:musician"]').attr('content') || 
                   $('meta[property="music:creator"]').attr('content') || 
                   $('meta[name="music:artist"]').attr('content') ||
                   '';
    
    const image = $('meta[property="og:image"]').attr('content') || 
                  $('meta[name="twitter:image"]').attr('content') || 
                  $('meta[property="twitter:image"]').attr('content') ||
                  '';

    // Try to get audio URL from Spotify embed or meta tags
    const audioUrl = $('meta[property="og:audio"]').attr('content') || 
                     $('meta[property="twitter:player:stream"]').attr('content') ||
                     url;

    return { 
      url: audioUrl || url, 
      platform: 'spotify', 
      title, 
      description, 
      author, 
      image, 
      content: description,
      followers: 0,
      engagement: 0,
    };
  } catch (error) {
    console.error('Spotify scraping error:', error);
    
    // Extract basic info from URL as fallback
    const urlParts = url.split('/');
    const type = urlParts[urlParts.length - 2] || 'content';
    const id = urlParts[urlParts.length - 1]?.split('?')[0] || 'unknown';
    
    return {
      url,
      platform: 'spotify',
      title: `Spotify ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      description: `Spotify ${type} content`,
      author: '',
      image: `https://i.scdn.co/image/${id}`,
      content: `Spotify ${type}`,
      followers: 0,
      engagement: 0,
    };
  }
}

async function scrapeAudioUrl(url: string): Promise<ScrapedData> {
  // For generic audio URLs, we can only extract basic information.
  // More detailed metadata would require specific API integrations or advanced analysis.
  return {
    url,
    platform: 'audio',
    title: 'Audio File',
    description: 'Direct link to an audio file',
    author: '',
    image: '',
    content: 'Audio content',
    followers: 0,
    engagement: 0,
  };
}

async function scrapeMedium(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Medium Article';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const author = $('meta[property="author"]').attr('content') || '';
  const publishDate = $('meta[property="article:published_time"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  $('script, style, nav, footer, header').remove();
  const content = $('article').text().trim() || $('main').text().trim();
  const tags = $('meta[property="article:tag"]').map((_, el) => $(el).attr('content')).get();

  return { url, platform: 'medium', title, description, author, publishDate, image, content: content.substring(0, 10000), tags };
}

async function scrapeSubstack(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Substack Post';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const author = $('meta[name="author"]').attr('content') || '';
  const publishDate = $('time').attr('datetime') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  $('script, style, nav, footer, header').remove();
  const content = $('.body').text().trim() || $('article').text().trim();

  return { url, platform: 'substack', title, description, author, publishDate, image, content: content.substring(0, 10000) };
}

async function scrapeGitcoin(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Gitcoin Grant';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  $('script, style').remove();
  const content = $('.grant-description').text().trim() || $('main').text().trim();

  return { url, platform: 'gitcoin', title, description, image, content: content.substring(0, 10000) };
}

async function scrapeGiveth(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Giveth Project';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  $('script, style').remove();
  const content = $('.project-description').text().trim() || $('main').text().trim();

  return { url, platform: 'giveth', title, description, image, content: content.substring(0, 10000) };
}

async function scrapeGitHub(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'GitHub Project';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const author = $('meta[property="profile:username"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  $('script, style').remove();
  const content = $('.markdown-body').text().trim() || $('#readme').text().trim() || $('.repository-content').text().trim();

  return { url, platform: 'github', title, description, author, image, content: content.substring(0, 10000) };
}

async function scrapeFarcaster(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Farcaster Channel';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const author = $('meta[property="profile:username"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  $('script, style').remove();
  const content = $('main').text().trim() || $('.profile').text().trim() || $('body').text().trim();

  return { url, platform: 'farcaster', title, description, author, image, content: content.substring(0, 10000) };
}

async function scrapeTwitch(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Twitch Channel';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const author = $('meta[property="og:site_name"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  $('script, style').remove();
  const content = $('.channel-info-content').text().trim() || $('main').text().trim() || $('body').text().trim();

  return { url, platform: 'twitch', title, description, author, image, content: content.substring(0, 10000) };
}

async function scrapeGenericBlog(url: string): Promise<ScrapedData> {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);

  const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Web Content';
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  const author = $('meta[name="author"]').attr('content') || '';
  const publishDate = $('meta[property="article:published_time"]').attr('content') || $('time').attr('datetime') || '';
  const image = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || '';

  let content = '';
  const contentSelectors = ['article', '[role="main"]', '.post-content', '.entry-content', '.content', 'main'];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      element.find('script, style, nav, footer, header').remove();
      content = element.text().trim();
      if (content.length > 100) break;
    }
  }

  if (!content || content.length < 100) {
    $('script, style, nav, footer, header').remove();
    content = $('body').text().trim();
  }

  content = content.replace(/\s+/g, ' ').trim();
  const tags = $('meta[name="keywords"]').attr('content')?.split(',').map(tag => tag.trim()) || [];

  return { url, platform: 'blog', title, description, author, publishDate, image, content: content.substring(0, 10000), tags };
}

async function scrapeEventbrite(url: string): Promise<ScrapedData> {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    
    const title = $('h1[class*="event-title"]').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('title').text().replace(' | Eventbrite', '').trim() || 
                  'Eventbrite Event';
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || 
                       $('div[class*="event-description"]').text().trim() || '';
    
    const image = $('meta[property="og:image"]').attr('content') || 
                  $('img[class*="event-image"]').attr('src') || '';
    
    const author = $('div[class*="organizer"]').text().trim() || 
                   $('a[class*="organizer-link"]').text().trim() || 
                   'Event Organizer';
    
    const publishDate = $('meta[property="event:start_time"]').attr('content') || 
                       $('time[datetime]').attr('datetime') || '';

    return {
      url,
      platform: 'eventbrite',
      title,
      description,
      author,
      publishDate,
      image,
      content: description,
    };
  } catch (error) {
    console.error('Eventbrite scraping error:', error);
    return {
      url,
      platform: 'eventbrite',
      title: 'Eventbrite Event',
      description: 'Event from Eventbrite',
      author: 'Event Organizer',
    };
  }
}

async function scrapeLuma(url: string): Promise<ScrapedData> {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Luma Event';
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || '';
    
    const image = $('meta[property="og:image"]').attr('content') || '';
    
    const author = $('meta[property="event:organizer"]').attr('content') || 
                   'Event Host';
    
    const publishDate = $('meta[property="event:start_time"]').attr('content') || '';

    return {
      url,
      platform: 'luma',
      title,
      description,
      author,
      publishDate,
      image,
      content: description,
    };
  } catch (error) {
    console.error('Luma scraping error:', error);
    return {
      url,
      platform: 'luma',
      title: 'Luma Event',
      description: 'Event from Luma',
      author: 'Event Host',
    };
  }
}

async function scrapeMeetup(url: string): Promise<ScrapedData> {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Meetup Event';
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || '';
    
    const image = $('meta[property="og:image"]').attr('content') || '';
    
    const author = $('meta[property="event:organizer"]').attr('content') || 
                   'Meetup Organizer';
    
    const publishDate = $('meta[property="event:start_time"]').attr('content') || 
                       $('time[datetime]').attr('datetime') || '';

    return {
      url,
      platform: 'meetup',
      title,
      description,
      author,
      publishDate,
      image,
      content: description,
    };
  } catch (error) {
    console.error('Meetup scraping error:', error);
    return {
      url,
      platform: 'meetup',
      title: 'Meetup Event',
      description: 'Event from Meetup',
      author: 'Meetup Organizer',
    };
  }
}

async function scrapePartiful(url: string): Promise<ScrapedData> {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Partiful Event';
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || '';
    
    const image = $('meta[property="og:image"]').attr('content') || '';
    
    const author = 'Event Host';
    const publishDate = $('meta[property="event:start_time"]').attr('content') || '';

    return {
      url,
      platform: 'partiful',
      title,
      description,
      author,
      publishDate,
      image,
      content: description,
    };
  } catch (error) {
    console.error('Partiful scraping error:', error);
    return {
      url,
      platform: 'partiful',
      title: 'Partiful Event',
      description: 'Event from Partiful',
      author: 'Event Host',
    };
  }
}

export async function scrapeByPlatform(url: string, platform: PlatformType): Promise<ScrapedData> {
  try {
    // Handle Spotify URLs
    if (platform === 'spotify' || url.includes('spotify.com')) {
      return scrapeSpotify(url);
    }

    // Handle generic audio URLs
    if (platform === 'audio' || url.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      return scrapeAudioUrl(url);
    }

    switch (platform) {
      case 'youtube':
        return await scrapeYouTube(url);
      case 'medium':
        return await scrapeMedium(url);
      case 'substack':
        return await scrapeSubstack(url);
      case 'gitcoin':
        return await scrapeGitcoin(url);
      case 'giveth':
        return await scrapeGiveth(url);
      case 'tiktok':
        return await scrapeTikTokOembed(url);
      case 'instagram':
        return await scrapeInstagramOembed(url);
      case 'twitter':
        return await scrapeTwitterNitter(url);
      case 'github':
        return await scrapeGitHub(url);
      case 'farcaster':
        return await scrapeFarcaster(url);
      case 'twitch':
        return await scrapeTwitch(url);
      case 'eventbrite':
        return await scrapeEventbrite(url);
      case 'luma':
        return await scrapeLuma(url);
      case 'meetup':
        return await scrapeMeetup(url);
      case 'partiful':
        return await scrapePartiful(url);
      case 'blog':
      default:
        return await scrapeGenericBlog(url);
    }
  } catch (error) {
    throw error;
  }
}