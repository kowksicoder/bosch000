
export function updateOGMeta(data: {
  title: string;
  description: string;
  image?: string;
  url?: string;
}) {
  // Update title
  document.title = data.title;
  
  // Update OG tags
  const setMetaTag = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
    }
    tag.content = content;
  };

  setMetaTag('og:title', data.title);
  setMetaTag('og:description', data.description);
  setMetaTag('twitter:title', data.title);
  setMetaTag('twitter:description', data.description);
  
  if (data.image) {
    setMetaTag('og:image', data.image);
    setMetaTag('twitter:image', data.image);
  }
  
  if (data.url) {
    setMetaTag('og:url', data.url);
    setMetaTag('twitter:url', data.url);
  }
}
