const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', 'utf8');

// Use Counter-Clockwise outer box, and default nonzero fillRule!
code = code.replace(
  /<Svg width=\{SCAN_W\} height=\{SCAN_H\} viewBox="0 0 220 205">[\s\S]*?<\/Svg>/m,
  `<Svg width={SCAN_W} height={SCAN_H} viewBox="0 0 220 205">
              <Path 
                d={\`M-10,-10 L-10,250 L250,250 L250,-10 Z \${HEART}\`} 
                fill="#000" 
                fillRule="nonzero" 
              />
              <AnimatedPath d={HEART} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
            </Svg>`
);

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', code);
