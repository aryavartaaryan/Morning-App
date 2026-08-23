const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', 'utf8');

code = code.replace(
  /const onResult = useCallback\(\(data: any\) => \{[\s\S]*?\}\);[\s\S]*?\}, \[go\]\);/,
  `const onResult = useCallback((data: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    go('results');
    setLiveHR(data.heartRateBpm);
    
    let color = '#10b981';
    let label = 'Low Stress';
    let emoji = '😌';
    let subtitle = 'Your nervous system is balanced and relaxed.';
    
    if (data.stressScore > 500) {
      color = '#ef4444'; label = 'High Stress'; emoji = '⚡';
      subtitle = 'Elevated sympathetic activity detected.';
    } else if (data.stressScore > 150) {
      color = '#f59e0b'; label = 'Moderate Stress'; emoji = '🤔';
      subtitle = 'You are experiencing moderate strain.';
    }
    
    setResult({
      ...data, color, label, emoji, subtitle,
      advice: [
        'Take 5 deep breaths focusing on exhaling slowly.',
        'Consider a short meditation session.'
      ]
    });
  }, [go]);`
);

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', code);
