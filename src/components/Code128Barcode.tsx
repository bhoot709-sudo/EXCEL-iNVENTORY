import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export interface Code128BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  font?: string;
  margin?: number;
  background?: string;
  lineColor?: string;
  className?: string;
  barCount?: number;
}

export function Code128Barcode({
  value,
  width = 1.8,
  height = 45,
  displayValue = true,
  fontSize = 12,
  font = 'monospace',
  margin = 4,
  background = '#ffffff',
  lineColor = '#000000',
  className = '',
  barCount = 56,
}: Code128BarcodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // Clean and sanitize string for Code128
        const cleanVal = value.trim();
        if (cleanVal) {
          const densityFactor = Math.max(0.55, Math.min(2.0, barCount / 56));
          const effectiveWidth = Math.max(0.5, Math.round(width * densityFactor * 100) / 100);
          const effectiveMargin = Math.max(0, Math.round(margin * densityFactor));

          JsBarcode(svgRef.current, cleanVal, {
            format: 'CODE128',
            width: effectiveWidth,
            height,
            displayValue,
            fontSize,
            font,
            margin: effectiveMargin,
            background,
            lineColor,
            textMargin: 3,
          });
        }
      } catch (err) {
        console.error('Error generating Code128 barcode for value:', value, err);
      }
    }
  }, [value, width, height, displayValue, fontSize, font, margin, background, lineColor, barCount]);

  return (
    <svg
      ref={svgRef}
      className={`inline-block select-none ${className}`}
      data-code128-sku={value}
    />
  );
}
