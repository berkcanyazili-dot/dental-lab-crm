"use client";

import { useState } from "react";

interface Props {
  selected: number[];
  missing: number[];
  onChange?: (selected: number[], missing: number[]) => void;
  readOnly?: boolean;
}

type Mode = "select" | "missing";

const TOOTH_NAMES: Record<number, string> = {
  1: "UR8", 2: "UR7", 3: "UR6", 4: "UR5", 5: "UR4", 6: "UR3", 7: "UR2", 8: "UR1",
  9: "UL1", 10: "UL2", 11: "UL3", 12: "UL4", 13: "UL5", 14: "UL6", 15: "UL7", 16: "UL8",
  17: "LL8", 18: "LL7", 19: "LL6", 20: "LL5", 21: "LL4", 22: "LL3", 23: "LL2", 24: "LL1",
  25: "LR1", 26: "LR2", 27: "LR3", 28: "LR4", 29: "LR5", 30: "LR6", 31: "LR7", 32: "LR8",
};

function Tooth({
  num,
  isSelected,
  isMissing,
  onClick,
  readOnly,
}: {
  num: number;
  isSelected: boolean;
  isMissing: boolean;
  onClick?: () => void;
  readOnly?: boolean;
}) {
  const isIncisor = (num >= 6 && num <= 11) || (num >= 22 && num <= 27);
  const isPremolar = [4, 5, 12, 13, 20, 21, 28, 29].includes(num);

  let bg = "bg-gray-700 border-gray-600";
  if (isMissing) bg = "bg-gray-900 border-red-900";
  else if (isSelected) bg = "bg-sky-600 border-sky-400";
  else bg = "bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500";

  return (
    <div className="flex flex-col items-center gap-0.5">
      {num <= 16 && (
        <span className="text-[8px] text-gray-500 leading-none">{num}</span>
      )}
      <button
        type="button"
        onClick={readOnly ? undefined : onClick}
        title={`Tooth ${num} (${TOOTH_NAMES[num]})`}
        className={`relative border rounded-sm transition-all flex items-center justify-center
          ${isIncisor ? "w-5 h-6" : isPremolar ? "w-5.5 h-5" : "w-6 h-5"}
          ${readOnly ? "cursor-default" : "cursor-pointer"}
          ${bg}
        `}
        style={{
          width: isIncisor ? "18px" : isPremolar ? "20px" : "22px",
          height: num <= 16 ? (isIncisor ? "24px" : "20px") : (isIncisor ? "24px" : "20px"),
        }}
      >
        {isMissing ? (
          <span className="text-red-700 text-[10px] font-bold leading-none">✕</span>
        ) : isSelected ? (
          <span className="text-white text-[8px] font-bold leading-none">●</span>
        ) : null}
      </button>
      {num > 16 && (
        <span className="text-[8px] text-gray-500 leading-none">{num}</span>
      )}
    </div>
  );
}

export default function ToothDiagram({ selected, missing, onChange, readOnly }: Props) {
  const [mode, setMode] = useState<Mode>("select");

  const upper = Array.from({ length: 16 }, (_, i) => i + 1);
  const lower = Array.from({ length: 16 }, (_, i) => i + 17);

  const handleClick = (num: number) => {
    if (readOnly || !onChange) return;
    if (mode === "select") {
      const next = selected.includes(num)
        ? selected.filter((t) => t !== num)
        : [...selected, num];
      onChange(next, missing);
    } else {
      const next = missing.includes(num)
        ? missing.filter((t) => t !== num)
        : [...missing, num];
      onChange(selected.filter((t) => t !== num), next);
    }
  };

  const clearAll = () => onChange && onChange([], []);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              type="button"
              onClick={() => setMode("select")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === "select" ? "bg-sky-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
            >
              Select Teeth
            </button>
            <button
              type="button"
              onClick={() => setMode("missing")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === "missing" ? "bg-red-700 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
            >
              Mark Missing
            </button>
          </div>
          {(selected.length > 0 || missing.length > 0) && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear All
            </button>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            {selected.length > 0 && `Selected: ${selected.sort((a, b) => a - b).join(", ")}`}
          </span>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 select-none">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500 font-medium">UPPER RIGHT</span>
          <span className="text-[10px] text-gray-500 font-medium">UPPER LEFT</span>
        </div>

        {/* Upper teeth */}
        <div className="flex items-end justify-center gap-0.5 pb-2 border-b border-gray-700/50">
          {upper.map((n) => (
            <Tooth
              key={n}
              num={n}
              isSelected={selected.includes(n)}
              isMissing={missing.includes(n)}
              onClick={() => handleClick(n)}
              readOnly={readOnly}
            />
          ))}
        </div>

        {/* Center label */}
        <div className="flex justify-center py-1">
          <span className="text-[9px] text-gray-600 tracking-widest">MIDLINE</span>
        </div>

        {/* Lower teeth */}
        <div className="flex items-start justify-center gap-0.5 pt-2 border-t border-gray-700/50">
          {lower.map((n) => (
            <Tooth
              key={n}
              num={n}
              isSelected={selected.includes(n)}
              isMissing={missing.includes(n)}
              onClick={() => handleClick(n)}
              readOnly={readOnly}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-500 font-medium">LOWER LEFT</span>
          <span className="text-[10px] text-gray-500 font-medium">LOWER RIGHT</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sky-600 border border-sky-400 inline-block" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-900 border border-red-900 inline-block flex items-center justify-center">
            <span className="text-red-700 text-[8px] font-bold">✕</span>
          </span>
          Missing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-700 border border-gray-600 inline-block" />
          Normal
        </span>
        {missing.length > 0 && (
          <span className="ml-auto text-gray-500">
            Missing: {missing.sort((a, b) => a - b).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
