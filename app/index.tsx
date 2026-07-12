import { View } from 'react-native';

export default function Index() {
  // Renders a blank screen by default.
  // The actual routing is handled by AuthGuard in _layout.tsx once the setup phase completes.
  // This prevents the home page from mounting in the background during the setup download.
  return <View style={{ flex: 1, backgroundColor: '#020617' }} />;
}
