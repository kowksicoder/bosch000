import { Path } from 'wouter';

/**
 * Safe navigation utility to prevent [object Object] URLs
 * @param setLocation The setLocation function from useLocation
 * @param path The path to navigate to
 * @param params Optional query parameters
 * @param hash Optional URL hash fragment
 */
export function safeNavigate(
  setLocation: (to: Path) => void, 
  path: string | { pathname: string; search?: string; hash?: string } | undefined,
  params?: Record<string, string | undefined>,
  hash?: string
) {
  // Handle undefined path
  if (!path) {
    console.error('Navigation path is undefined');
    return;
  }

  // Convert path object to string
  let finalPath: string;
  if (typeof path === 'object') {
    finalPath = path.pathname;
    // Add existing search params if any
    if (path.search) {
      finalPath += path.search;
    }
    // Add existing hash if any
    if (path.hash) {
      finalPath += path.hash;
    }
  } else {
    finalPath = String(path);
  }

  // Ensure we start with a forward slash
  if (!finalPath.startsWith('/')) {
    finalPath = '/' + finalPath;
  }

  // If there are query params, add them to the URL
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      // If path already has search params, append with &, otherwise use ?
      finalPath += finalPath.includes('?') ? '&' : '?';
      finalPath += queryString;
    }
  }

  // Add hash fragment if provided
  if (hash) {
    finalPath += `#${hash.replace(/^#/, '')}`;
  }

  // Final validation
  try {
    // Validate the URL is well-formed
    new URL(finalPath, window.location.origin);
    // Navigate
    setLocation(finalPath);
  } catch (error) {
    console.error('Invalid navigation path:', finalPath, error);
  }
}