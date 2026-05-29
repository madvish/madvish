import React from "react";
import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { CHART_PALETTE } from "@/src/theme/colors";

interface Slice {
  amount: number;
}

interface DonutChartProps {
  data: Slice[];
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  children?: React.ReactNode;
}

export function DonutChart({
  data,
  size = 180,
  strokeWidth = 24,
  trackColor,
  children,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.amount, 0);

  let offsetAccum = 0;
  const segments =
    total > 0
      ? data.map((d, i) => {
          const fraction = d.amount / total;
          const dash = fraction * circumference;
          const seg = {
            color: CHART_PALETTE[i % CHART_PALETTE.length],
            dasharray: `${dash} ${circumference - dash}`,
            dashoffset: -offsetAccum,
          };
          offsetAccum += dash;
          return seg;
        })
      : [];

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {segments.map((seg, i) => (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={seg.dasharray}
              strokeDashoffset={seg.dashoffset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      {children}
    </View>
  );
}
