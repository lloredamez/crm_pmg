export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (hostname.includes('promotorapmg.com.br')) {
      return `${protocol}//apicrm.promotorapmg.com.br`;
    }
    return `${protocol}//${hostname}:5052`;
  }
  return 'http://localhost:5052';
}
