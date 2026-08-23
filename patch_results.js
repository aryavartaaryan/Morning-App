const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', 'utf8');

// 1. Update onResult
code = code.replace(
  /let subtitle = 'Your nervous system is balanced and relaxed\.';[\s\S]*?setResult\(\{/m,
  `let subtitle = 'Your nervous system is balanced and relaxed.';
    
    if (data.stressScore > 500) {
      color = '#ef4444'; label = 'High Stress'; emoji = '⚡';
      subtitle = 'Elevated sympathetic activity detected.';
    } else if (data.stressScore > 150) {
      color = '#f59e0b'; label = 'Moderate Stress'; emoji = '🤔';
      subtitle = 'You are experiencing moderate strain.';
    }

    let hrvColor = '#3b82f6';
    let hrvLabel = 'Typical / Normal';
    let hrvSubtitle = 'In line with the general healthy adult average.';
    
    if (data.rmssd < 19) {
      hrvColor = '#8b5cf6';
      hrvLabel = 'Lower than typical';
      hrvSubtitle = 'Lower parasympathetic activity than the general adult average.';
    } else if (data.rmssd > 75) {
      hrvColor = '#0ea5e9';
      hrvLabel = 'Higher than typical';
      hrvSubtitle = 'Generally favorable, often seen in fit individuals.';
    }
    
    setResult({`
);

code = code.replace(
  /advice: \[\n\s*'Take 5 deep breaths focusing on exhaling slowly\.',\n\s*'Consider a short meditation session\.'\n\s*\]/,
  `hrvColor, hrvLabel, hrvSubtitle,
      advice: [
        'Take 5 deep breaths focusing on exhaling slowly.',
        'Consider a short meditation session.'
      ]`
);

// 2. Update renderResults to fix `result.score` and add HRV card
code = code.replace(
  /<View style=\{\[S\.resCard, \{ borderColor: result\.color \}\]\}>[\s\S]*?<\/View>\s*<\/View>/m,
  `<View style={[S.resCard, { borderColor: result.color }]}>
            <View style={S.resRow}>
              <Text style={S.resKey}>Heart Rate</Text>
              <Text style={S.resVal}>{liveHR} BPM</Text>
            </View>
            <View style={[S.resRow, { borderBottomWidth: 0, marginTop: 12 }]}>
              <Text style={S.resKey}>Baevsky Stress Index</Text>
              <Text style={[S.resVal, { color: result.color, fontSize: 24 }]}>{result.stressScore}</Text>
            </View>
          </View>

          <Text style={S.sectionTitle}>Heart Rate Variability (HRV)</Text>
          <View style={[S.resCard, { borderColor: result.hrvColor, backgroundColor: '#161b22' }]}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: result.hrvColor, marginBottom: 4 }}>{result.hrvLabel}</Text>
            
            <View style={S.resRow}>
              <Text style={S.resKey}>RMSSD (Short-term)</Text>
              <Text style={S.resVal}>{result.rmssd} ms</Text>
            </View>
            <View style={[S.resRow, { borderBottomWidth: 0 }]}>
              <Text style={S.resKey}>SDNN (Overall)</Text>
              <Text style={S.resVal}>{result.sdnn} ms</Text>
            </View>
            
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#333' }}>
              <Text style={{ color: '#9ca3af', fontSize: 13, lineHeight: 20 }}>
                {result.hrvSubtitle} 
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 13, lineHeight: 20, marginTop: 8, fontStyle: 'italic' }}>
                Note: This compares to the general population (Nunan et al.). A single reading is just one data point. Tracking your personal trend over time is far more meaningful.
              </Text>
            </View>
          </View>`
);

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', code);
