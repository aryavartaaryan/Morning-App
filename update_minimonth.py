import sys

with open('app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

old_str = """  const MiniMonthGrid = ({ monthDate, festivalsData }: { monthDate: Date, festivalsData: any[] }) => {
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const firstDayOfWeek = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
    const days = Array(firstDayOfWeek).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));

    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          Haptics.selectionAsync();
          setCurrentMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
          setPickerMode('month');
        }}
        style={{ width: (SCREEN_W - 32 - 32) / 3, marginBottom: 20 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '800', color: NEBULA_PURPLE, marginBottom: 6, paddingLeft: 2, letterSpacing: 0.8 }}>
          {monthDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2.5, rowGap: 2.5 }}>
          {days.map((date, i) => {
            if (!date) return <View key={i} style={{ width: 9, height: 9 }} />;
            const isToday = date.getDate() === new Date().getDate() && date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
            const festMatch = festivalsData.find(f => f.date.getDate() === date.getDate() && f.date.getMonth() === date.getMonth());
            return (
              <View key={i} style={{ 
                width: 9, height: 9, borderRadius: 2,
                backgroundColor: festMatch ? (festMatch.festival.type === 'hindu' ? NEBULA_GOLD : NEBULA_CYAN) : (isToday ? NEBULA_PINK : 'rgba(255,255,255,0.08)'),
                borderWidth: isToday ? 0.5 : 0, borderColor: 'rgba(236,72,153,0.8)'
              }} />
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };"""

new_str = """  const MiniMonthGrid = ({ monthDate, festivalsData }: { monthDate: Date, festivalsData: any[] }) => {
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const firstDayOfWeek = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
    const days = Array(firstDayOfWeek).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));

    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          Haptics.selectionAsync();
          setCurrentMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
          setPickerMode('month');
        }}
        style={{ width: (SCREEN_W - 32 - 16) / 3, marginBottom: 20 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '800', color: NEBULA_PURPLE, marginBottom: 4, paddingLeft: 2, letterSpacing: 0.8 }}>
          {monthDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
        </Text>
        
        {/* Weekday headers for MiniMonthGrid */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <View key={i} style={{ width: `${100/7}%`, alignItems: 'center' }}>
              <Text style={{ fontSize: 7, fontWeight: '800', color: i === 0 ? NEBULA_PINK + 'CC' : 'rgba(255,255,255,0.4)' }}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
          {days.map((date, i) => {
            if (!date) return <View key={i} style={{ width: `${100/7}%`, height: 14 }} />;
            const isToday = date.getDate() === new Date().getDate() && date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
            const festMatch = festivalsData.find(f => f.date.getDate() === date.getDate() && f.date.getMonth() === date.getMonth());
            
            const isSunday = date.getDay() === 0;

            return (
              <View key={i} style={{ 
                width: `${100/7}%`, height: 14, alignItems: 'center', justifyContent: 'center'
              }}>
                {isToday && (
                  <View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: NEBULA_PINK }} />
                )}
                {festMatch && !isToday && (
                  <View style={{ position: 'absolute', top: 11, width: 3, height: 3, borderRadius: 1.5, backgroundColor: festMatch.festival.type === 'hindu' ? NEBULA_GOLD : NEBULA_CYAN }} />
                )}
                <Text style={{ fontSize: 8, fontWeight: isToday ? '900' : '600', color: isToday ? '#FFF' : (isSunday ? NEBULA_PINK + 'CC' : 'rgba(255,255,255,0.85)') }}>
                  {date.getDate()}
                </Text>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('app/(tabs)/index.tsx', 'w') as f:
        f.write(content)
    print("Replaced successfully!")
else:
    print("Could not find the target string!")
