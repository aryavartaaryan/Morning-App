import re

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/wallpaper.tsx', 'r') as f:
    content = f.read()

# Fix imports
content = re.sub(
    r"import \{ useBgContext \} from '\./_layout';\nimport \{ BG_KEYS, BG_META, BgKey, getCategoryOfKey, getTimedBgKey \} from '\.\./lib/bgImages';\nimport \{ AsyncWallpaperImage \} from '\.\./components/AsyncWallpaperImage';",
    """import { useBgContext, BG_KEYS, BG_META, type BgKey, getTimedBgKey } from '@/lib/bgContext';
import { getBgSourceSync, getBgSource } from '@/lib/bgImages';
import { Image } from 'react-native';

function AsyncWallpaperImage({ bgKey }: { bgKey: string }) {
  const [imgUri, setImgUri] = React.useState<string | null>(() => getBgSourceSync(bgKey));

  React.useEffect(() => {
    let mounted = true;
    getBgSource(bgKey).then(uri => {
      if (mounted && uri) setImgUri(uri);
    });
    return () => { mounted = false; };
  }, [bgKey]);

  if (!imgUri || imgUri.length < 5) return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111' }]} />;
  
  return (
    <Image
      source={{ uri: imgUri }}
      style={StyleSheet.absoluteFillObject}
      resizeMode="cover"
    />
  );
}

const getCategoryOfKey = (key: string): 'morning' | 'day' | 'sunset' | 'night' => {
  if (key.includes('morning') || key.includes('predawn') || key.includes('sunrise') || key.includes('brahma')) return 'morning';
  if (key.includes('day') || key.includes('noon')) return 'day';
  if (key.includes('sunset') || key.includes('golden') || key.includes('dusk')) return 'sunset';
  return 'night';
};""",
    content
)

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/wallpaper.tsx', 'w') as f:
    f.write(content)

# Fix sleep.tsx
with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx', 'r') as f:
    sleep_content = f.read()

if "import { AppState" not in sleep_content:
    sleep_content = sleep_content.replace(
        "import { View, Text, StyleSheet, ScrollView",
        "import { View, Text, StyleSheet, ScrollView, AppState"
    )
    with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx', 'w') as f:
        f.write(sleep_content)

print("done")
