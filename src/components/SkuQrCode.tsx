import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export interface SkuQrCodeProps {
  value: string;
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  className?: string;
  title?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export function SkuQrCode({
  value,
  size = 48,
  margin = 0,
  darkColor = '#0f172a',
  lightColor = '#ffffff',
  className = '',
  title,
  errorCorrectionLevel = 'M',
}: SkuQrCodeProps) {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const cleanValue = value ? value.trim() : '';

    if (!cleanValue) {
      setSvgContent('');
      return;
    }

    QRCode.toString(cleanValue, {
      type: 'svg',
      width: size,
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel,
    })
      .then((svgStr) => {
        if (isMounted) {
          // Ensure SVG has proper dimensions and scaling attributes
          const adjustedSvg = svgStr
            .replace(/<svg /, `<svg width="${size}" height="${size}" class="block" style="display:block; shape-rendering: crispEdges;" `);
          setSvgContent(adjustedSvg);
        }
      })
      .catch((err) => {
        console.error('Failed to generate SKU QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size, margin, darkColor, lightColor, errorCorrectionLevel]);

  if (!svgContent) {
    return (
      <div
        className={`inline-flex items-center justify-center bg-slate-100 rounded text-slate-400 font-mono text-[9px] ${className}`}
        style={{ width: size, height: size }}
      >
        QR
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${className}`}
      title={title || `SKU QR Code: ${value}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{ width: size, height: size }}
    />
  );
}
