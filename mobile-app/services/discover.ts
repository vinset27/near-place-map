import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SHOWN = 'nearplace:discoverPromptShown:v1';
const KEY_LAST_QUERY = 'nearplace:discoverLastQuery:v1';

export async function getDiscoverPromptShown(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY_SHOWN);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setDiscoverPromptShown(shown: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_SHOWN, shown ? '1' : '0');
  } catch {
    // ignore
  }
}

export async function getDiscoverLastQuery(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY_LAST_QUERY)) || '';
  } catch {
    return '';
  }
}

export async function setDiscoverLastQuery(q: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_LAST_QUERY, String(q || '').slice(0, 120));
  } catch {
    // ignore
  }
}






