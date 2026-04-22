// Placeholder — this page has not been implemented yet. Next's Pages Router requires
// a default export even for dynamic routes so that tsc doesn't flag it as "not a module".
// Redirects to the markets index.
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function MarketSymbolPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/markets');
  }, [router]);
  return null;
}
