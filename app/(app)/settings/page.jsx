import { Suspense } from 'react';
import SettingsPage from '@/views/SettingsPage.jsx';
import Loading from '@/components/Loading.jsx';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsPage />
    </Suspense>
  );
}
