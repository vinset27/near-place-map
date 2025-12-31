/**
 * Alias route: /lists -> /list
 * (The web used /list, but some users type /lists. Keep UX forgiving.)
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export default function ListsAlias() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/list');
  }, [router]);
  return <View />;
}






