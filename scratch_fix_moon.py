import sys

def main():
    file_path = 'components/LunarStoryModal.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Remove the import
    target_import = "import { MoonSVG } from './MoonSVG';"
    rep_import = "import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';"
    if target_import in content:
        content = content.replace(target_import, rep_import)

    # 2. Inject MoonSVG function
    moon_svg_func = """
export function MoonSVG({ tithiNum, size = 40 }: { tithiNum: number; size?: number }) {
  const r = size / 2;
  const isWaxing  = tithiNum <= 15;
  const isPurnima = tithiNum === 15;
  const isAmavasya = tithiNum === 0 || tithiNum === 30;
  const rawIllum  = isPurnima ? 1 : isAmavasya ? 0
    : isWaxing ? tithiNum / 15
    : 1 - (tithiNum - 15) / 15;

  const moonFill = '#fef3c7';
  const darkFill = '#0c0c1a';

  if (rawIllum < 0.02) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} stroke="#2d2d4e" strokeWidth={0.8} />
      </Svg>
    );
  }
  if (rawIllum > 0.98) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <SvgCircle cx={r} cy={r} r={r - 0.5} fill={moonFill} />
      </Svg>
    );
  }

  const rx = Math.max(0.5, r * Math.abs(Math.cos(Math.PI * rawIllum)));
  const outerSweep      = isWaxing ? 1 : 0;
  const terminatorSweep = (isWaxing === (rawIllum >= 0.5)) ? 1 : 0;
  const c = r;
  const s = size;
  const pathD = `M ${c} 0 A ${r} ${r} 0 1 ${outerSweep} ${c} ${s} A ${rx} ${r} 0 0 ${terminatorSweep} ${c} 0 Z`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} />
      <SvgPath d={pathD} fill={moonFill} />
    </Svg>
  );
}
"""
    
    target_insert = "const { width: W, height: H } = Dimensions.get('window');"
    if target_insert in content:
        content = content.replace(target_insert, target_insert + "\n" + moon_svg_func)

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
