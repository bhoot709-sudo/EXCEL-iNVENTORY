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
}: Code128BarcodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // Clean and sanitize string for Code128
        const cleanVal = value.trim();
        if (cleanVal) {
          JsBarcode(svgRef.current, cleanVal, {
            format: 'CODE128',
            width,
            height,
            displayValue,
            fontSize,
            font,
            margin,
            background,
            lineColor,
            textMargin: 3,
          });
        }
      } catch (err) {
        console.error('Error generating Code128 barcode for value:', value, err);
      }
    }
  }, [value, width, height, displayValue, fontSize, font, margin, background, lineColor]);

  return (
    <svg
      ref={svgRef}
      className={`inline-block select-none ${className}`}
      data-code128-sku={value}
    />
  );
}
