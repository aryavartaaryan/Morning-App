import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Find where the Almanac tab renders.
    old_code = """function AlmanacTab({ p, timings, moon, karanaName }: { p: any, timings: any, moon: any, karanaName: string }) {
  const { bgUri, bgKey } = useBgContext();
  const [showCalendar, setShowCalendar] = useState(false);
  const [panchangaDetail, setPanchangaDetail] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    fetchWeather().then(setWeather).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1 }}>"""
    
    new_code = """function AlmanacTab({ p, timings, moon, karanaName }: { p: any, timings: any, moon: any, karanaName: string }) {
  const { bgUri, bgKey } = useBgContext();
  const [showCalendar, setShowCalendar] = useState(false);
  const [panchangaDetail, setPanchangaDetail] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    fetchWeather().then(setWeather).catch(() => {});
  }, []);

  return (
    <>
    <View style={{ flex: 1 }}>"""

    if old_code in content:
        content = content.replace(old_code, new_code)
    else:
        # try another signature
        old_code_2 = """  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 120, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>"""
        new_code_2 = """  return (
    <>
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 120, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>"""
        content = content.replace(old_code_2, new_code_2)

    # Now fix the end of the return
    end_old = """            <Text style={{ fontSize: 11, color: TXT, fontWeight: '800', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5 }}>How it affects you</Text>
            <Text style={{ fontSize: 15, color: 'rgba(44,44,44,0.8)', lineHeight: 22, marginBottom: 28 }}>{panchangaDetail?.effect}</Text>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPanchangaDetail(null); }} style={{ width: '100%', paddingVertical: 16, borderRadius: 100, backgroundColor: BURG, alignItems: 'center', justifyContent: 'center', shadowColor: BURG, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>GOT IT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}"""

    end_new = """            <Text style={{ fontSize: 11, color: TXT, fontWeight: '800', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5 }}>How it affects you</Text>
            <Text style={{ fontSize: 15, color: 'rgba(44,44,44,0.8)', lineHeight: 22, marginBottom: 28 }}>{panchangaDetail?.effect}</Text>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPanchangaDetail(null); }} style={{ width: '100%', paddingVertical: 16, borderRadius: 100, backgroundColor: BURG, alignItems: 'center', justifyContent: 'center', shadowColor: BURG, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>GOT IT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
    </>
  );
}"""

    # If I already moved `{showCalendar...}` inside the View, I need to put it back out just to be safe or leave it.
    
    # Just to be completely safe, I'll use a brute force regex to wrap the whole AlmanacTab return in <> </>.
    
    with open(file_path, 'w') as f:
        f.write(content)
        
if __name__ == "__main__":
    main()
