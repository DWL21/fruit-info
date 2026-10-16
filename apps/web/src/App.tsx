import { useEffect } from 'react';
import { Layout } from './components/Layout.tsx';
import { trackPage } from './lib/analytics.ts';
import { match, useLocation } from './lib/router.ts';
import { HomePage } from './pages/HomePage.tsx';
import { ItemPage } from './pages/ItemPage.tsx';
import { MapPage } from './pages/MapPage.tsx';
import { StorePage } from './pages/StorePage.tsx';
import { PhotoPage } from './pages/PhotoPage.tsx';
import { ShootPage } from './pages/ShootPage.tsx';
import { NotFound } from './components/States.tsx';

export function App() {
  const location = useLocation();
  useEffect(() => {
    trackPage(location);
  }, [location]);
  const path = location.split('?')[0]!;
  if (path === '/shoot') return <ShootPage />;

  let page = <NotFound />;
  let p: Record<string, string> | null;
  if (path === '/') page = <HomePage />;
  else if (path === '/map') page = <MapPage />;
  else if ((p = match('/item/:slug', path))) page = <ItemPage slug={p.slug!} />;
  else if ((p = match('/store/:id', path))) page = <StorePage id={Number(p.id)} />;
  else if ((p = match('/photo/:id', path))) page = <PhotoPage id={p.id!} focus={Number(new URLSearchParams(location.split('?')[1]).get('obs')) || null} />;
  return <Layout path={path}>{page}</Layout>;
}
