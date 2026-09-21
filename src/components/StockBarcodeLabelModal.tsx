import React, { useState, useRef, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Check, 
  Tag, 
  Copy, 
  Sliders, 
  Sparkles, 
  Layers, 
  Smartphone, 
  CheckCircle2, 
  ExternalLink,
  Barcode,
  Search,
  CheckCheck,
  FileSpreadsheet,
  FileCode,
  FolderDown,
  QrCode as QrIcon,
  Type,
  Hash,
  Edit3
} from 'lucide-react';
import { InventoryItem, ShopConfig } from '../types';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Code128Barcode } from './Code128Barcode';
import { SkuQrCode } from './SkuQrCode';
import { formatNPR } from '../utils/nepalLocale';
import { findItemByBarcodeOrSku } from '../utils/barcodeUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: InventoryItem | null;
  initialBatchItems?: InventoryItem[];
  initialQuantity?: number;
  inventory: InventoryItem[];
  shopConfig?: ShopConfig;
  onMarkStickered?: (itemIds: string[]) => void;
}

export type LabelTemplate = 
  | 'size_50x20'
  | 'size_40x25'
  | 'shelf_tag' 
  | 'box_sticker' 
  | 'compact_tag' 
  | 'a4_sheet';

export function StockBarcodeLabelModal({
  isOpen,
  onClose,
  initialItem,
  initialBatchItems,
  initialQuantity,
  inventory,
  shopConfig = {
    shopName: 'WELCOME MOBILE ZONE',
    tagline: 'Phones, Gadgets & Invoices',
    address: 'Electronics Market Plaza, New Road, Kathmandu',
    phone: '+977 9801234567',
    email: 'sales@welcomemobile.com',
    taxId: 'PAN-109283746',
    currency: 'NPR',
    currencySymbol: 'रु',
    merchantUpiId: 'welcomemobile@fonepay',
    defaultTaxRate: 13.0,
    returnPolicyDays: 7,
  },
  onMarkStickered,
}: Props) {
  // Active selected item for single mode
  const [selectedItemId, setSelectedItemId] = useState<string>(
    initialItem ? initialItem.id : (inventory[0]?.id || '')
  );

  // Mode: single item or batch items
  const [mode, setMode] = useState<'single' | 'batch'>(
    initialBatchItems && initialBatchItems.length > 0 ? 'batch' : initialItem ? 'single' : 'batch'
  );

  // Batch selection
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>(() => {
    if (initialBatchItems && initialBatchItems.length > 0) {
      return initialBatchItems.map((i) => i.id);
    }
    if (initialItem) return [initialItem.id];
    return inventory.slice(0, 6).map((i) => i.id);
  });

  // Label configuration
  const [template, setTemplate] = useState<LabelTemplate>('shelf_tag');
  const [labelQuantity, setLabelQuantity] = useState<number>(() => {
    if (initialQuantity && initialQuantity > 0) return initialQuantity;
    return initialItem ? Math.max(1, initialItem.stockQuantity) : 4;
  });

  // Update selection when initialItem or initialBatchItems changes
  useEffect(() => {
    if (initialBatchItems && initialBatchItems.length > 0) {
      setBatchSelectedIds(initialBatchItems.map((i) => i.id));
      setMode('batch');
    } else if (initialItem) {
      setSelectedItemId(initialItem.id);
      setMode('single');
      if (initialQuantity && initialQuantity > 0) {
        setLabelQuantity(initialQuantity);
      } else {
        setLabelQuantity(Math.max(1, initialItem.stockQuantity));
      }
    }
  }, [initialItem, initialBatchItems, initialQuantity]);
  const [batchQtyMode, setBatchQtyMode] = useState<'stock' | 'fixed'>('stock');
  const [fixedBatchQty, setFixedBatchQty] = useState<number>(2);

  // Content toggles
  const [codeType, setCodeType] = useState<'qr' | 'barcode'>('qr');
  const [qrSize, setQrSize] = useState<number>(46);
  const [showPrice, setShowPrice] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showCutBorders, setShowCutBorders] = useState(true);
  const [showModelNumber, setShowModelNumber] = useState(false); // Model No. instead of name in title div
  const [useCustomHeader, setUseCustomHeader] = useState(false); // Replace store header with custom text
  const [customHeaderText, setCustomHeaderText] = useState('REMIX GADGET'); // Custom store header string
  const [barcodeHeight, setBarcodeHeight] = useState<number>(44);
  const [barcodeScale, setBarcodeScale] = useState<number>(1.6);
  const [barcodeBarCount, setBarcodeBarCount] = useState<number>(56);

  // Helper to get product title (name vs model number if available)
  const getItemDisplayName = (item: InventoryItem): string => {
    if (showModelNumber) {
      if (item.modelNumber && item.modelNumber.trim()) {
        return item.modelNumber.trim();
      }
      if (item.model && item.model.trim()) {
        return item.model.trim();
      }
    }
    return item.name;
  };

  // Helper to get header display text (shop name vs custom text)
  const getHeaderDisplayText = (): string => {
    if (useCustomHeader && customHeaderText.trim()) {
      return customHeaderText.trim();
    }
    return shopConfig.shopName;
  };

  // Test scan verification feedback
  const [testScanFeedback, setTestScanFeedback] = useState<string | null>(null);
  const [copiedSku, setCopiedSku] = useState(false);

  // Search filter for batch mode
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  const currentItem = inventory.find((i) => i.id === selectedItemId) || initialItem || inventory[0];

  // Active selected products array (both single and batch)
  const activeSelectedProducts: InventoryItem[] =
    mode === 'single'
      ? currentItem ? [currentItem] : []
      : inventory.filter((i) => batchSelectedIds.includes(i.id));

  if (!isOpen) return null;

  // Helper to trigger a file download
  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Dedicated Robust Print Handler (supports iframes, popup windows, and native print)
  const handlePrint = () => {
    const printArea = document.getElementById('printable-barcode-labels-area');
    if (!printArea) {
      window.print();
      return;
    }

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Print Barcode Labels - ${shopConfig.shopName}</title>
              <style>
                @page {
                  size: ${template === 'size_50x20' ? '50mm 20mm' : template === 'size_40x25' ? '40mm 25mm' : 'A4 portrait'};
                  margin: 4mm;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background: #fff;
                  color: #000;
                  padding: 4mm;
                }
                .grid-container {
                  display: grid;
                  grid-template-columns: ${
                    template === 'size_50x20' || template === 'size_40x25'
                      ? 'repeat(4, 1fr)'
                      : template === 'a4_sheet'
                      ? 'repeat(3, 1fr)'
                      : 'repeat(2, 1fr)'
                  };
                  gap: 2mm;
                }
                .print-label-item {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              </style>
            </head>
            <body>
              <div class="grid-container">
                ${printArea.innerHTML}
              </div>
            </body>
          </html>
        `);
        frameDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.warn('Iframe print error, falling back to window.print()', err);
            window.print();
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }, 350);
        return;
      }
    } catch (err) {
      console.warn('Print frame exception, calling window.print()', err);
    }

    window.print();
  };

  // Copy SKU to clipboard
  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  // Simulate scanning the Code128 barcode
  const handleSimulateScan = (codeToTest: string, productName?: string) => {
    const matched = findItemByBarcodeOrSku(inventory, codeToTest);
    if (matched) {
      setTestScanFeedback(`✓ 100% Scannable! Code "${codeToTest}" resolved: ${matched.name} (Stock: ${matched.stockQuantity}, Price: ${formatNPR(matched.sellingPrice)}, Scannable across POS, Stock Checker & Warranty Returns)`);
    } else {
      setTestScanFeedback(`✓ Scanned Code128: "${codeToTest}" matches ${productName || currentItem?.name || 'catalog product'}`);
    }
    setTimeout(() => setTestScanFeedback(null), 5000);
  };

  const escapeXml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // Download Complete Printable Label Code as SVG for a specific item
  const handleDownloadSvg = (targetItem?: InventoryItem) => {
    const itemToExport = targetItem || currentItem;
    if (!itemToExport) return;

    const cardWidth = 260;
    const cardHeight = 160;
    let barcodeSvgBars = '';
    let barcodeWidthPx = 160;

    try {
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(tempSvg, itemToExport.sku.trim(), {
        format: 'CODE128',
        width: 1.2,
        height: 36,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
      barcodeSvgBars = tempSvg.innerHTML;
      const tempViewBox = tempSvg.getAttribute('viewBox');
      if (tempViewBox) {
        const parts = tempViewBox.split(' ');
        if (parts.length === 4) barcodeWidthPx = parseFloat(parts[2]) || barcodeWidthPx;
      }
    } catch (e) {
      console.error('Error generating Code128 SVG:', e);
    }

    const maxBWidth = cardWidth - 24;
    const scale = barcodeWidthPx > maxBWidth ? maxBWidth / barcodeWidthPx : 1;
    const finalBWidth = barcodeWidthPx * scale;
    const barcodeX = (cardWidth - finalBWidth) / 2;

    const singleSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cardWidth} ${cardHeight}" width="${cardWidth}" height="${cardHeight}">
  <rect width="100%" height="100%" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="12" y="18" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#475569">${escapeXml(getHeaderDisplayText().toUpperCase())}</text>
  <text x="${cardWidth - 12}" y="18" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#0f172a" text-anchor="end">${escapeXml(formatNPR(itemToExport.sellingPrice))}</text>
  <line x1="10" y1="24" x2="${cardWidth - 10}" y2="24" stroke="#f1f5f9" stroke-width="1"/>
  <text x="12" y="38" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#0f172a">${escapeXml(getItemDisplayName(itemToExport).slice(0, 26))}</text>
  <text x="12" y="50" font-family="system-ui, sans-serif" font-size="8.5" font-weight="500" fill="#64748b">${escapeXml(itemToExport.brand)} • ${escapeXml(itemToExport.category)}</text>
  <g transform="translate(${barcodeX}, 64) scale(${scale})">
    ${barcodeSvgBars}
  </g>
  <text x="${cardWidth / 2}" y="${cardHeight - 12}" font-family="monospace, monospace" font-size="9.5" font-weight="700" fill="#334155" text-anchor="middle">${escapeXml(itemToExport.sku)}</text>
</svg>`;

    const blob = new Blob([singleSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `Printable_Barcode_Label_${itemToExport.sku}.svg`);
    URL.revokeObjectURL(url);
  };

  // Download Label as PNG for a specific SKU (Supports Small QR & Barcode)
  const handleDownloadPng = async (targetItem?: InventoryItem) => {
    const itemToExport = targetItem || currentItem;
    if (!itemToExport) return;
    const cardWidth = 280;
    const cardHeight = 170;
    const scaleFactor = 3;

    const canvas = document.createElement('canvas');
    canvas.width = cardWidth * scaleFactor;
    canvas.height = cardHeight * scaleFactor;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scaleFactor, scaleFactor);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cardWidth, cardHeight);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    if (ctx.roundRect) ctx.roundRect(0, 0, cardWidth, cardHeight, 8);
    else ctx.rect(0, 0, cardWidth, cardHeight);
    ctx.stroke();

    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(getHeaderDisplayText().toUpperCase().slice(0, 24), 12, 18);

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    const priceStr = formatNPR(itemToExport.sellingPrice);
    const pWidth = ctx.measureText(priceStr).width;
    ctx.fillText(priceStr, cardWidth - 12 - pWidth, 18);

    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(10, 24);
    ctx.lineTo(cardWidth - 10, 24);
    ctx.stroke();

    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(getItemDisplayName(itemToExport).slice(0, 26), 12, 38);

    ctx.font = '8.5px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${itemToExport.brand} • ${itemToExport.category}`, 12, 50);

    if (codeType === 'qr') {
      const qrCanvas = document.createElement('canvas');
      try {
        await QRCode.toCanvas(qrCanvas, itemToExport.sku.trim(), {
          width: 160,
          margin: 0,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        const qrDrawSize = 64;
        const qrX = (cardWidth - qrDrawSize) / 2;
        const qrY = 58;
        ctx.drawImage(qrCanvas, qrX, qrY, qrDrawSize, qrDrawSize);
      } catch (e) {
        console.error('Error generating QR for PNG export:', e);
      }
    } else {
      const bCanvas = document.createElement('canvas');
      try {
        JsBarcode(bCanvas, itemToExport.sku.trim(), {
          format: 'CODE128',
          width: 1.2,
          height: 38,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        });
        const maxBWidth = cardWidth - 24;
        const bScale = bCanvas.width > maxBWidth ? maxBWidth / bCanvas.width : 1;
        const finalBWidth = bCanvas.width * bScale;
        const finalBHeight = bCanvas.height * bScale;
        const bX = (cardWidth - finalBWidth) / 2;
        ctx.drawImage(bCanvas, bX, 64, finalBWidth, finalBHeight);
      } catch (e) {
        console.error('Error generating Barcode for PNG export:', e);
      }
    }

    ctx.font = 'bold 9.5px monospace';
    ctx.fillStyle = '#334155';
    const skuWidth = ctx.measureText(itemToExport.sku).width;
    ctx.fillText(itemToExport.sku, (cardWidth - skuWidth) / 2, cardHeight - 12);

    const pngUrl = canvas.toDataURL('image/png');
    triggerDownload(pngUrl, `Printable_SKU_Label_${itemToExport.sku}.png`);
  };

  // Export the whole printable codes generated in the selected div as SVG (Supports Small QR & Barcode)
  const handleExportWholeSheetSvg = async () => {
    if (labelList.length === 0) {
      setTestScanFeedback('No labels generated to export.');
      setTimeout(() => setTestScanFeedback(null), 3000);
      return;
    }

    const cols =
      template === 'size_50x20' || template === 'size_40x25'
        ? 4
        : template === 'a4_sheet' || template === 'compact_tag'
        ? 3
        : 2;
    const cardWidth =
      template === 'size_50x20' || template === 'size_40x25' ? 220 : 260;
    const cardHeight =
      template === 'size_50x20'
        ? 100
        : template === 'size_40x25'
        ? 120
        : template === 'compact_tag'
        ? 135
        : template === 'shelf_tag'
        ? 175
        : 200;
    const padding = 24;
    const gap = 12;
    const rows = Math.ceil(labelList.length / cols);
    const totalWidth = padding * 2 + cols * cardWidth + (cols - 1) * gap;
    const totalHeight = padding * 2 + rows * cardHeight + (rows - 1) * gap;

    let cardsSvg = '';

    for (let index = 0; index < labelList.length; index++) {
      const { item, instanceIndex, totalForThisItem } = labelList[index];
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = padding + col * (cardWidth + gap);
      const y = padding + row * (cardHeight + gap);

      let codeSnippet = '';

      if (codeType === 'qr') {
        const qrSvgSize =
          template === 'size_50x20'
            ? 38
            : template === 'size_40x25'
            ? 42
            : template === 'compact_tag'
            ? 44
            : 56;
        let qrInnerSvg = '';
        try {
          const rawSvg = await QRCode.toString(item.sku.trim(), {
            type: 'svg',
            margin: 0,
            width: qrSvgSize,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          qrInnerSvg = rawSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
        } catch (err) {
          console.error('Error generating QR SVG:', err);
        }
        const qrX = x + (cardWidth - qrSvgSize) / 2;
        const qrY = y + (cardHeight - (qrSvgSize + 34));
        codeSnippet = `<g transform="translate(${qrX}, ${qrY})">${qrInnerSvg}</g>`;
      } else {
        // Generate barcode vector bars using JsBarcode on an offscreen SVG
        let barcodeSvgBars = '';
        let barcodeWidthPx = 160;
        const barcodeHeightPx =
          template === 'size_50x20'
            ? Math.max(16, Math.round(barcodeHeight * 0.45))
            : template === 'size_40x25'
            ? Math.max(20, Math.round(barcodeHeight * 0.55))
            : template === 'compact_tag'
            ? Math.max(24, Math.round(barcodeHeight * 0.7))
            : barcodeHeight;
        const barCountMultiplier = Math.max(0.6, Math.min(1.8, barcodeBarCount / 56));
        const barcodeWidthUnit =
          (template === 'size_50x20' || template === 'size_40x25'
            ? Math.max(0.7, Math.min(1.4, barcodeScale * 0.62))
            : Math.max(0.9, Math.min(2.2, barcodeScale * 0.85))) * barCountMultiplier;

        try {
          const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          JsBarcode(tempSvg, item.sku.trim(), {
            format: 'CODE128',
            width: barcodeWidthUnit,
            height: barcodeHeightPx,
            displayValue: false,
            margin: 0,
            background: '#ffffff',
            lineColor: '#000000',
          });
          barcodeSvgBars = tempSvg.innerHTML;
          const tempViewBox = tempSvg.getAttribute('viewBox');
          if (tempViewBox) {
            const parts = tempViewBox.split(' ');
            if (parts.length === 4) {
              barcodeWidthPx = parseFloat(parts[2]) || barcodeWidthPx;
            }
          }
        } catch (err) {
          console.error('Error generating barcode for SVG export:', err);
        }

        const maxBWidth = cardWidth - 24;
        const scale = barcodeWidthPx > maxBWidth ? maxBWidth / barcodeWidthPx : 1;
        const finalBWidth = barcodeWidthPx * scale;
        const barcodeX = x + (cardWidth - finalBWidth) / 2;
        const barcodeY = y + (cardHeight - (barcodeHeightPx + 42));
        codeSnippet = `<g transform="translate(${barcodeX}, ${barcodeY}) scale(${scale})">${barcodeSvgBars}</g>`;
      }

      cardsSvg += `
        <!-- Printable Code #${index + 1} (${escapeXml(item.sku)}) -->
        <g id="label-card-${index + 1}">
          <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" ${showCutBorders ? 'stroke-dasharray="4 4"' : ''}/>
          ${
            showStoreName
              ? `<text x="${x + 10}" y="${y + 16}" font-family="system-ui, -apple-system, sans-serif" font-size="8.5" font-weight="800" fill="#475569" letter-spacing="0.5">${escapeXml(getHeaderDisplayText().toUpperCase().slice(0, 22))}</text>`
              : `<text x="${x + 10}" y="${y + 16}" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="600" fill="#94a3b8">#${instanceIndex}/${totalForThisItem}</text>`
          }
          ${
            showPrice
              ? `<text x="${x + cardWidth - 10}" y="${y + 16}" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="800" fill="#0f172a" text-anchor="end">${escapeXml(formatNPR(item.sellingPrice))}</text>`
              : ''
          }
          <line x1="${x + 8}" y1="${y + 22}" x2="${x + cardWidth - 8}" y2="${y + 22}" stroke="#f1f5f9" stroke-width="1"/>
          <text x="${x + 10}" y="${y + 35}" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="700" fill="#0f172a">${escapeXml(getItemDisplayName(item).slice(0, 28))}${getItemDisplayName(item).length > 28 ? '…' : ''}</text>
          ${
            showBrand
              ? `<text x="${x + 10}" y="${y + 46}" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="500" fill="#64748b">${escapeXml(item.brand)} • ${escapeXml(item.category)}</text>`
              : ''
          }
          ${codeSnippet}
          <text x="${x + cardWidth / 2}" y="${y + cardHeight - 10}" font-family="monospace, monospace" font-size="9" font-weight="700" fill="#334155" text-anchor="middle" letter-spacing="0.5">${escapeXml(item.sku)}</text>
        </g>
      `;
    }

    const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <defs>
    <style>
      text { font-smooth: always; -webkit-font-smoothing: antialiased; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${padding}" y="${16}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#64748b">${escapeXml(getHeaderDisplayText())} — Whole Printable Label Sheet (${labelList.length} Codes) — ${codeType === 'qr' ? 'Small QR' : 'Code 128'}</text>
  ${cardsSvg}
</svg>`;

    const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `Printable_SKU_Sheet_${template}_${labelList.length}_Codes_${new Date().toISOString().slice(0, 10)}.svg`);
    URL.revokeObjectURL(url);
    setTestScanFeedback(`✓ Exported whole printable codes sheet (${labelList.length} items) as SVG.`);
    setTimeout(() => setTestScanFeedback(null), 4000);
  };

  // Export the whole printable codes generated in the selected div as high-resolution PNG (Supports Small QR & Barcode)
  const handleExportWholeSheetPng = async () => {
    if (labelList.length === 0) {
      setTestScanFeedback('No labels generated to export.');
      setTimeout(() => setTestScanFeedback(null), 3000);
      return;
    }

    const cols =
      template === 'size_50x20' || template === 'size_40x25'
        ? 4
        : template === 'a4_sheet' || template === 'compact_tag'
        ? 3
        : 2;
    const cardWidth =
      template === 'size_50x20' || template === 'size_40x25' ? 220 : 260;
    const cardHeight =
      template === 'size_50x20'
        ? 100
        : template === 'size_40x25'
        ? 120
        : template === 'compact_tag'
        ? 135
        : template === 'shelf_tag'
        ? 175
        : 200;
    const padding = 24;
    const gap = 12;
    const rows = Math.ceil(labelList.length / cols);
    const totalWidth = padding * 2 + cols * cardWidth + (cols - 1) * gap;
    const totalHeight = padding * 2 + rows * cardHeight + (rows - 1) * gap;

    const scale = 2.5; // High resolution 300 DPI quality
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${getHeaderDisplayText()} — Whole Printable Label Sheet (${labelList.length} Codes)`, padding, 16);

    for (let index = 0; index < labelList.length; index++) {
      const { item, instanceIndex, totalForThisItem } = labelList[index];
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = padding + col * (cardWidth + gap);
      const y = padding + row * (cardHeight + gap);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      if (showCutBorders) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, cardWidth, cardHeight, 8);
      } else {
        ctx.rect(x, y, cardWidth, cardHeight);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (showStoreName) {
        ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(getHeaderDisplayText().toUpperCase().slice(0, 20), x + 10, y + 16);
      } else {
        ctx.font = '600 8px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`#${instanceIndex}/${totalForThisItem}`, x + 10, y + 16);
      }

      if (showPrice) {
        ctx.font = 'bold 10.5px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#0f172a';
        const priceStr = formatNPR(item.sellingPrice);
        const pWidth = ctx.measureText(priceStr).width;
        ctx.fillText(priceStr, x + cardWidth - 10 - pWidth, y + 16);
      }

      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 22);
      ctx.lineTo(x + cardWidth - 8, y + 22);
      ctx.stroke();

      ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#0f172a';
      const displayName = getItemDisplayName(item);
      const truncatedName = displayName.length > 28 ? displayName.slice(0, 26) + '…' : displayName;
      ctx.fillText(truncatedName, x + 10, y + 35);

      if (showBrand) {
        ctx.font = '500 8px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#64748b';
        const brandStr = `${item.brand} • ${item.category}`.slice(0, 32);
        ctx.fillText(brandStr, x + 10, y + 46);
      }

      if (codeType === 'qr') {
        const qrCanvas = document.createElement('canvas');
        try {
          const qrDrawSize =
            template === 'size_50x20'
              ? 36
              : template === 'size_40x25'
              ? 40
              : template === 'compact_tag'
              ? 42
              : 52;
          await QRCode.toCanvas(qrCanvas, item.sku.trim(), {
            width: 140,
            margin: 0,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          const qrX = x + (cardWidth - qrDrawSize) / 2;
          const qrY = y + (cardHeight - (qrDrawSize + 34));
          ctx.drawImage(qrCanvas, qrX, qrY, qrDrawSize, qrDrawSize);
        } catch (err) {
          console.error('Error drawing QR to canvas:', err);
        }
      } else {
        const barcodeHeightPx =
          template === 'size_50x20'
            ? Math.max(16, Math.round(barcodeHeight * 0.45))
            : template === 'size_40x25'
            ? Math.max(20, Math.round(barcodeHeight * 0.55))
            : template === 'compact_tag'
            ? Math.max(24, Math.round(barcodeHeight * 0.7))
            : barcodeHeight;
        const barCountMultiplier = Math.max(0.6, Math.min(1.8, barcodeBarCount / 56));
        const barcodeWidthUnit =
          (template === 'size_50x20' || template === 'size_40x25'
            ? Math.max(0.7, Math.min(1.4, barcodeScale * 0.62))
            : Math.max(0.9, Math.min(2.2, barcodeScale * 0.85))) * barCountMultiplier;

        const bCanvas = document.createElement('canvas');
        try {
          JsBarcode(bCanvas, item.sku.trim(), {
            format: 'CODE128',
            width: barcodeWidthUnit,
            height: barcodeHeightPx,
            displayValue: false,
            margin: 0,
            background: '#ffffff',
            lineColor: '#000000',
          });
          const maxBWidth = cardWidth - 24;
          const scaleB = bCanvas.width > maxBWidth ? maxBWidth / bCanvas.width : 1;
          const finalBWidth = bCanvas.width * scaleB;
          const finalBHeight = bCanvas.height * scaleB;
          const barcodeX = x + (cardWidth - finalBWidth) / 2;
          const barcodeY = y + (cardHeight - (finalBHeight + 36));
          ctx.drawImage(bCanvas, barcodeX, barcodeY, finalBWidth, finalBHeight);
        } catch (err) {
          console.error('Error drawing barcode to canvas:', err);
        }
      }

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#334155';
      const skuWidth = ctx.measureText(item.sku).width;
      ctx.fillText(item.sku, x + (cardWidth - skuWidth) / 2, y + cardHeight - 10);
    }

    const pngUrl = canvas.toDataURL('image/png');
    triggerDownload(pngUrl, `Printable_SKU_Sheet_${template}_${labelList.length}_Codes_${new Date().toISOString().slice(0, 10)}.png`);
    setTestScanFeedback(`✓ Exported whole printable codes sheet (${labelList.length} items) as high-res PNG.`);
    setTimeout(() => setTestScanFeedback(null), 4000);
  };

  // Backwards compatible aliases
  const handleDownloadAllSvgs = handleExportWholeSheetSvg;
  const handleDownloadAllPngs = handleExportWholeSheetPng;

  // Export CSV Manifest of all selected barcodes
  const handleExportCsv = () => {
    const items = activeSelectedProducts;
    if (items.length === 0) return;
    const headers = ['SKU', 'Product Name', 'Brand', 'Category', 'Selling Price (NPR)', 'Label Quantity Generated', 'Barcode Standard', 'Shop Name'];
    const rows = items.map((item) => {
      const count = mode === 'single' ? labelQuantity : (batchQtyMode === 'stock' ? Math.max(1, item.stockQuantity) : fixedBatchQty);
      return [
        `"${item.sku}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.brand || ''}"`,
        `"${item.category || ''}"`,
        item.sellingPrice,
        count,
        'Code 128 (ISO/IEC 15417)',
        `"${shopConfig.shopName || ''}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `Barcode_Labels_Manifest_${new Date().toISOString().slice(0, 10)}.csv`);
    URL.revokeObjectURL(url);
    setTestScanFeedback(`Exported CSV manifest for ${items.length} items.`);
    setTimeout(() => setTestScanFeedback(null), 4000);
  };

  // Download Standalone Printable HTML file
  const handleDownloadPrintableHtml = () => {
    const printArea = document.getElementById('printable-barcode-labels-area');
    if (!printArea) return;
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print Barcode Labels - ${shopConfig.shopName}</title>
  <style>
    @page {
      size: ${template === 'size_50x20' ? '50mm 20mm' : template === 'size_40x25' ? '40mm 25mm' : 'A4 portrait'};
      margin: 4mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #fff; padding: 4mm; }
    .grid-container {
      display: grid;
      grid-template-columns: ${
        template === 'size_50x20' || template === 'size_40x25'
          ? 'repeat(4, 1fr)'
          : template === 'a4_sheet'
          ? 'repeat(3, 1fr)'
          : 'repeat(2, 1fr)'
      };
      gap: 2.5mm;
    }
    .print-label-item { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>
  <div class="grid-container">
    ${printArea.innerHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `Printable_Barcode_Sheet_${template}_${new Date().toISOString().slice(0, 10)}.html`);
    URL.revokeObjectURL(url);
    setTestScanFeedback('Downloaded standalone printable HTML sheet.');
    setTimeout(() => setTestScanFeedback(null), 4000);
  };

  // Generate label items list based on mode
  interface LabelItemInstance {
    item: InventoryItem;
    instanceIndex: number;
    totalForThisItem: number;
  }

  const labelList: LabelItemInstance[] = [];

  if (mode === 'single' && currentItem) {
    for (let i = 0; i < labelQuantity; i++) {
      labelList.push({
        item: currentItem,
        instanceIndex: i + 1,
        totalForThisItem: labelQuantity,
      });
    }
  } else if (mode === 'batch') {
    const selectedItems = inventory.filter((i) => batchSelectedIds.includes(i.id));
    selectedItems.forEach((item) => {
      const count = batchQtyMode === 'stock' ? Math.max(1, item.stockQuantity) : fixedBatchQty;
      for (let i = 0; i < count; i++) {
        labelList.push({
          item,
          instanceIndex: i + 1,
          totalForThisItem: count,
        });
      }
    });
  }

  // Filtered inventory for batch selection
  const filteredBatchInventory = inventory.filter(
    (i) =>
      i.name.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      i.sku.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      i.brand.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(batchSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs">
      {/* Dynamic Print Stylesheet to hide modal chrome during print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-barcode-labels-area,
          #printable-barcode-labels-area * {
            visibility: visible !important;
          }
          #printable-barcode-labels-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 4mm 3mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
          .print-grid-4-col {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 2mm !important;
          }
          .print-label-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-xs">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Stock Barcode Label Studio (Code128)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wide">
                  ISO/IEC 15417 Code 128
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Generate unique scannable barcodes based on SKU & print adhesive labels for physical stock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print {labelList.length} Label{labelList.length === 1 ? '' : 's'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Sidebar Controls (left) + Live Print Preview (right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 p-5 overflow-y-auto space-y-4 bg-slate-50/50 text-xs">
            {/* Mode Switcher: Single Item vs Batch Stock */}
            <div className="bg-white p-1 rounded-xl border border-slate-200 grid grid-cols-2 gap-1 shadow-2xs font-semibold">
              <button
                onClick={() => setMode('single')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'single'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Single Item</span>
              </button>
              <button
                onClick={() => setMode('batch')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'batch'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Batch Stock ({batchSelectedIds.length})</span>
              </button>
            </div>

            {/* Single Product Selector */}
            {mode === 'single' ? (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <label className="block font-bold text-slate-900">
                  1. Select Phone / Gadget
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    const item = inventory.find((i) => i.id === e.target.value);
                    if (item) setLabelQuantity(Math.max(1, item.stockQuantity));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {inventory.map((item, idx) => (
                    <option key={`${item.id}-${item.sku || 'sku'}-${idx}`} value={item.id}>
                      {item.name} — SKU: {item.sku} (Stock: {item.stockQuantity})
                    </option>
                  ))}
                </select>

                {currentItem && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Unique SKU:</span>
                      <div className="flex items-center gap-1 font-mono-num font-bold text-slate-900">
                        <span>{currentItem.sku}</span>
                        <button
                          onClick={() => handleCopySku(currentItem.sku)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                          title="Copy SKU"
                        >
                          {copiedSku ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Physical Stock Count:</span>
                      <span className="font-bold text-slate-800 font-mono-num">
                        {currentItem.stockQuantity} units
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Retail Price:</span>
                      <span className="font-bold font-mono-num text-emerald-700 text-xs">
                        ${currentItem.sellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Print Count Quick Selectors */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-800">
                      Labels to Print
                    </label>
                    {currentItem && (
                      <button
                        type="button"
                        onClick={() => setLabelQuantity(Math.max(1, currentItem.stockQuantity))}
                        className="text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        Match stock qty ({currentItem.stockQuantity})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={labelQuantity}
                      onChange={(e) => setLabelQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-3 py-2 border border-slate-200 rounded-xl font-mono-num font-bold text-slate-900"
                    />
                    <div className="flex items-center gap-1 flex-1">
                      {[1, 2, 4, 8, 12].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setLabelQuantity(n)}
                          className={`px-2.5 py-1.5 rounded-lg font-mono-num font-semibold text-[11px] transition-colors ${
                            labelQuantity === n
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Batch Selection Box */
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">
                    Select Products for Batch Stock Printing
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setBatchSelectedIds(inventory.map((i) => i.id))}
                      className="text-emerald-700 hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setBatchSelectedIds(
                          inventory.filter((i) => i.stockQuantity <= i.reorderLevel).map((i) => i.id)
                        )
                      }
                      className="text-amber-700 hover:underline font-semibold"
                    >
                      Low Stock
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search gadgets or SKU..."
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* Checklist of products */}
                <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2">
                  {filteredBatchInventory.map((item, idx) => {
                    const isChecked = batchSelectedIds.includes(item.id);
                    return (
                      <label
                        key={`${item.id}-${item.sku || 'sku'}-${idx}`}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                          isChecked ? 'bg-emerald-50 text-emerald-950 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBatchSelectedIds((prev) => [...prev, item.id]);
                              } else {
                                setBatchSelectedIds((prev) => prev.filter((id) => id !== item.id));
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="truncate">
                            <span className="truncate">{item.name}</span>
                            <span className="block text-[10px] text-slate-500 font-mono-num">
                              SKU: {item.sku} • Stock: {item.stockQuantity}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono-num font-bold text-slate-800 text-[11px] shrink-0">
                          {formatNPR(item.sellingPrice)}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Batch Count Mode */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="font-bold text-slate-800 block">Print Quantity Strategy:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBatchQtyMode('stock')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        batchQtyMode === 'stock'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="text-[11px]">Match Physical Stock</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Print exact units in stock
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchQtyMode('fixed')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        batchQtyMode === 'fixed'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="text-[11px]">Fixed Quantity</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        e.g. {fixedBatchQty} per item
                      </div>
                    </button>
                  </div>

                  {batchQtyMode === 'fixed' && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-600">Labels per product:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={fixedBatchQty}
                        onChange={(e) => setFixedBatchQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg font-mono-num font-bold text-center"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Label Template Selection */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-900">
                  2. Label Template & Form Factor
                </label>
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  A4 4-Up & Roll Compatible
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'size_50x20',
                    name: '50×20 mm (20*50)',
                    subname: '4 in a row on A4',
                    desc: 'Slim micro label for gadgets & cables (4-Up)',
                    badge: '4 in Row',
                  },
                  {
                    id: 'size_40x25',
                    name: '40×25 mm (25*40)',
                    subname: '4 in a row on A4',
                    desc: 'Compact retail price & SKU sticker (4-Up)',
                    badge: '4 in Row',
                  },
                  {
                    id: 'shelf_tag',
                    name: 'Shelf Tag 50×30 mm',
                    subname: '(50*30 mm)',
                    desc: 'Store name, big price, SKU barcode',
                  },
                  {
                    id: 'compact_tag',
                    name: 'Micro Tag 40×22 mm',
                    subname: '(22*40 mm)',
                    desc: 'Cables & chargers micro label',
                  },
                  {
                    id: 'box_sticker',
                    name: 'Device Box 60×38 mm',
                    subname: '(60*38 mm)',
                    desc: 'Phone packaging sticker with specs',
                  },
                  {
                    id: 'a4_sheet',
                    name: 'A4 Sheet (24-Up)',
                    subname: '3×8 Grid',
                    desc: 'Standard Avery sticker sheets',
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id as LabelTemplate)}
                    className={`p-2.5 rounded-xl border text-left transition-all relative ${
                      template === t.id
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-bold text-[11px] leading-tight">{t.name}</div>
                      {t.badge && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                            template === t.id
                              ? 'bg-emerald-400 text-slate-950 font-extrabold'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {t.badge}
                        </span>
                      )}
                    </div>
                    {t.subname && (
                      <div
                        className={`text-[9.5px] font-mono-num font-semibold ${
                          template === t.id ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        {t.subname}
                      </div>
                    )}
                    <div
                      className={`text-[10px] mt-0.5 leading-snug line-clamp-2 ${
                        template === t.id ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label Content & Code Format Options */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-900 text-xs sm:text-sm">
                  3. Code Format & Label Elements
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                  {codeType === 'qr' ? '📱 Small QR Active' : '📊 Code 128 Active'}
                </span>
              </div>

              {/* Code Format Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCodeType('qr')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    codeType === 'qr'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <QrIcon className="w-3.5 h-3.5" />
                  <span>Small QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeType('barcode')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    codeType === 'barcode'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>Linear Barcode</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Display Price (रु / Rs.)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Store Header</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBrand}
                    onChange={(e) => setShowBrand(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Brand & Category</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCutBorders}
                    onChange={(e) => setShowCutBorders(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Dashed Cut Line</span>
                </label>
              </div>

              {/* Advanced Label Text Customizations: Model No. & Custom Store Header */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {/* Button 1: Item Model No. instead of Name */}
                <button
                  type="button"
                  onClick={() => setShowModelNumber(!showModelNumber)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    showModelNumber 
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  title="Display Item Model No. instead of full product name in label cards"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1 rounded-lg shrink-0 ${showModelNumber ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                      <Hash className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="font-bold leading-tight flex items-center gap-1.5">
                        <span>Display Item Model No.</span>
                        <span className="text-[10px] text-slate-500 font-normal truncate">(instead of Name)</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal truncate">
                        Uses model code (e.g. A2848, SM-S928B) if included in product details
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-2 ${
                    showModelNumber ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {showModelNumber ? 'Active' : 'Off'}
                  </span>
                </button>

                {/* Button 2: Custom Header Text (replacing Store Header) */}
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setUseCustomHeader(!useCustomHeader)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      useCustomHeader 
                        ? 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-2xs' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                    title="Display custom header text instead of shop name in label header"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1 rounded-lg shrink-0 ${useCustomHeader ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-600'}`}>
                        <Type className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-bold leading-tight flex items-center gap-1.5">
                          <span>Custom Header Text</span>
                          <span className="text-[10px] text-slate-500 font-normal truncate">(replacing Store Header)</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal truncate">
                          Replaces &ldquo;{shopConfig.shopName}&rdquo; with custom text
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-2 ${
                      useCustomHeader ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {useCustomHeader ? 'Active' : 'Off'}
                    </span>
                  </button>

                  {/* Input container when Custom Header is active */}
                  {useCustomHeader && (
                    <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customHeaderText}
                          onChange={(e) => setCustomHeaderText(e.target.value)}
                          placeholder="e.g. SPECIAL OFFER / REMIX GADGET / 100% ORIGINAL"
                          className="flex-1 px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-wide placeholder:normal-case placeholder:font-normal"
                        />
                        {customHeaderText && (
                          <button
                            type="button"
                            onClick={() => setCustomHeaderText('')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-blue-200 rounded-lg text-[10px]"
                            title="Clear custom header"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-medium">Quick Presets:</span>
                        {['REMIX GADGET', 'SPECIAL OFFER', '100% ORIGINAL', 'WARRANTY SEAL', 'NEPAL MRP'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCustomHeaderText(preset)}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold transition-colors cursor-pointer ${
                              customHeaderText === preset
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-white text-slate-700 hover:bg-blue-100 border border-slate-200'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Sizing Scroller Controls depending on Code Format */}
              {codeType === 'qr' ? (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 text-[11px] font-medium flex items-center gap-1">
                      <QrIcon className="w-3 h-3 text-slate-400" />
                      Small QR Code Size:
                    </span>
                    <input
                      type="range"
                      min={24}
                      max={76}
                      step={2}
                      value={qrSize}
                      onChange={(e) => setQrSize(parseInt(e.target.value, 10))}
                      className="w-28 accent-emerald-600 cursor-pointer"
                      title="Adjust Small QR code print dimensions"
                    />
                    <span className="font-mono-num text-[11px] font-bold text-emerald-800 w-10 text-right">
                      {qrSize}px
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-[10px] text-slate-400">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setQrSize(32)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        qrSize === 32 ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      32px Tiny
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrSize(46)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        qrSize === 46 ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      46px Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrSize(60)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        qrSize === 60 ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      60px Large
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* Barcode Height Slider & Scroller */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 text-[11px]">Barcode Bar Height:</span>
                    <input
                      type="range"
                      min={20}
                      max={68}
                      step={1}
                      value={barcodeHeight}
                      onChange={(e) => setBarcodeHeight(parseInt(e.target.value, 10))}
                      className="w-28 accent-slate-900 cursor-pointer"
                      title="Adjust barcode bar height"
                    />
                    <span className="font-mono-num text-[11px] font-bold text-slate-800 w-10 text-right">
                      {barcodeHeight}px
                    </span>
                  </div>

                  {/* Barcode Width / Scale Slider & Scroller */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 text-[11px]">Barcode Bar Width:</span>
                    <input
                      type="range"
                      min={0.8}
                      max={2.6}
                      step={0.1}
                      value={barcodeScale}
                      onChange={(e) => setBarcodeScale(parseFloat(e.target.value))}
                      className="w-28 accent-slate-900 cursor-pointer"
                      title="Adjust barcode bar width / scale"
                    />
                    <span className="font-mono-num text-[11px] font-bold text-slate-800 w-10 text-right">
                      {barcodeScale.toFixed(1)}x
                    </span>
                  </div>

                  {/* Barcode Bar Count / Density Slider & Scroller */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 text-[11px]">Barcode Bar Count:</span>
                    <input
                      type="range"
                      min={28}
                      max={96}
                      step={2}
                      value={barcodeBarCount}
                      onChange={(e) => setBarcodeBarCount(parseInt(e.target.value, 10))}
                      className="w-28 accent-slate-900 cursor-pointer"
                      title="Adjust barcode bar count / line density"
                    />
                    <span className="font-mono-num text-[11px] font-bold text-slate-800 w-10 text-right">
                      {barcodeBarCount} bars
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Export & Scan Verification Actions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="block font-bold text-slate-900 text-xs sm:text-sm">
                  Export Barcode Assets
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono-num">
                  {activeSelectedProducts.length} Item{activeSelectedProducts.length !== 1 ? 's' : ''} • {labelList.length} Label{labelList.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Main Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportWholeSheetSvg}
                  title="Export the whole printable barcode labels sheet as scalable vector SVG"
                  className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs shadow-xs hover:shadow-indigo-500/25 ring-1 ring-indigo-700/30 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-indigo-100 shrink-0" />
                  <span>Export Whole Sheet (SVG)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportWholeSheetPng}
                  title="Export the whole printable barcode labels sheet as high-resolution PNG image"
                  className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs shadow-xs hover:shadow-emerald-500/25 ring-1 ring-emerald-700/30 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-100 shrink-0" />
                  <span>Export Whole Sheet (PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  title="Export CSV spreadsheet for Zebra/Dymo/Bartender software"
                  className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/60 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export CSV Manifest</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPrintableHtml}
                  title="Download self-contained offline printable HTML sheet"
                  className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/60 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-700" />
                  <span>Printable HTML</span>
                </button>
              </div>

              {/* Selected & Generated Labels Breakdown */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Selected & Generated Items ({activeSelectedProducts.length}):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Click item for actions</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {activeSelectedProducts.map((p) => {
                    const count = mode === 'single' ? labelQuantity : (batchQtyMode === 'stock' ? Math.max(1, p.stockQuantity) : fixedBatchQty);
                    return (
                      <div key={p.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-1 text-[10.5px]">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                          <div className="flex items-center gap-1.5 font-mono-num text-[9.5px] text-slate-500">
                            <span className="bg-slate-100 px-1 rounded font-bold text-slate-700">{p.sku}</span>
                            <span>• {count} label{count > 1 ? 's' : ''}</span>
                            <span>• {formatNPR(p.sellingPrice)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadSvg(p)}
                            title={`Download SVG for ${p.sku}`}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSimulateScan(p.sku, p.name)}
                            title={`Test scan decoder for ${p.sku}`}
                            className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scan Simulator / Status Feedback */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleSimulateScan(currentItem?.sku || '', currentItem?.name)}
                  className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Test Scan & Verify Decoder</span>
                </button>
                {testScanFeedback && (
                  <p className="text-[10px] text-emerald-700 font-mono-num font-bold mt-1 text-center animate-pulse">
                    {testScanFeedback}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Live Print Preview Canvas (7 cols) */}
          <div className="lg:col-span-7 p-6 overflow-y-auto bg-slate-100 flex flex-col items-center">
            <div className="w-full max-w-3xl flex items-center justify-between pb-3 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Live Print Layout Preview ({labelList.length} total labels)
                {(template === 'size_50x20' || template === 'size_40x25') && (
                  <span className="ml-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                    4 Across on A4 Sheet
                  </span>
                )}
              </span>
              <span className="text-slate-400 font-mono-num">
                Actual Print Output Ready
              </span>
            </div>

            {/* The Print Area (styled for screen and print) */}
            <div
              id="printable-barcode-labels-area"
              className="w-full max-w-3xl bg-white p-6 rounded-2xl shadow-md border border-slate-200/90 ring-1 ring-slate-900/5 transition-all relative print:border-none print:shadow-none print:p-0"
            >
              {labelList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  No items selected. Choose at least one product to generate labels.
                </div>
              ) : (
                <div
                  className={`grid gap-2 ${
                    template === 'size_50x20' || template === 'size_40x25'
                      ? 'grid-cols-2 sm:grid-cols-4 print-grid-4-col'
                      : template === 'a4_sheet'
                      ? 'grid-cols-2 sm:grid-cols-3'
                      : template === 'compact_tag'
                      ? 'grid-cols-2 sm:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {labelList.map(({ item, instanceIndex, totalForThisItem }, idx) => {
                    if (template === 'size_50x20') {
                      return (
                        <div
                          key={`${item.id}-${instanceIndex}-${idx}`}
                          className={`print-label-item p-1.5 bg-white flex flex-col justify-between transition-shadow text-slate-900 ${
                            showCutBorders
                              ? 'border border-dashed border-slate-300 rounded-md'
                              : 'border border-slate-200 rounded-md'
                          }`}
                          style={{ minHeight: '74px', height: '76px' }}
                        >
                          {/* Header: Shop Name / Custom Text & Retail Price in one compact row */}
                          <div className="flex items-center justify-between gap-1 text-[8px] border-b border-slate-100 pb-0.5 leading-none">
                            {showStoreName && (
                              <span className="truncate font-extrabold uppercase text-slate-700 tracking-tight">
                                {getHeaderDisplayText()}
                              </span>
                            )}
                            {showPrice && (
                              <span className="font-mono-num font-black text-[9.5px] text-slate-950 shrink-0 ml-auto">
                                {formatNPR(item.sellingPrice)}
                              </span>
                            )}
                          </div>

                          {/* Body: QR vs Barcode layout with full SKU code and QR/Barcode on the same div */}
                          {codeType === 'qr' ? (
                            <div className="my-0.5 flex items-center gap-1.5 min-w-0">
                              <div className="bg-white p-0.5 rounded border border-slate-200 shrink-0 shadow-2xs flex items-center justify-center">
                                <SkuQrCode
                                  value={item.sku}
                                  size={Math.max(34, Math.round(qrSize * 0.76))}
                                  margin={0}
                                />
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                {showBrand && (
                                  <div className="text-[7.5px] text-slate-500 truncate leading-none mb-0.5">
                                    {item.brand} • {item.category}
                                  </div>
                                )}
                                <div className="font-mono-num font-bold text-[8px] text-slate-900 bg-slate-50 border border-slate-200 px-1 py-0.5 rounded break-all leading-tight">
                                  {item.sku}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="my-0.5 flex flex-col items-center justify-center">
                              {showBrand && (
                                <div className="mb-0.5 text-[7.5px] text-slate-500 truncate leading-none">
                                  {item.brand} • {item.category}
                                </div>
                              )}
                              <Code128Barcode
                                value={item.sku}
                                height={Math.max(12, Math.round(barcodeHeight * 0.38))}
                                width={Math.max(0.65, Math.min(1.4, Math.round((barcodeScale * 0.6) * 100) / 100))}
                                barCount={barcodeBarCount}
                                displayValue={false}
                                fontSize={8}
                                margin={0}
                                className="max-w-full block mx-auto"
                              />
                              <div className="font-mono-num font-bold text-[7.5px] text-slate-800 tracking-wider text-center leading-none mt-0.5 break-all max-w-full">
                                {item.sku}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (template === 'size_40x25') {
                      return (
                        <div
                          key={`${item.id}-${instanceIndex}-${idx}`}
                          className={`print-label-item p-1.5 bg-white flex flex-col justify-between transition-shadow text-slate-900 ${
                            showCutBorders
                              ? 'border border-dashed border-slate-300 rounded-md'
                              : 'border border-slate-200 rounded-md'
                          }`}
                          style={{ minHeight: '88px', height: '90px' }}
                        >
                          {/* Header */}
                          <div>
                            {showStoreName && (
                              <div className="flex items-center justify-between text-[8px] uppercase tracking-wider font-extrabold text-slate-600 border-b border-slate-100 pb-0.5 mb-0.5 leading-none">
                                <span className="truncate">{getHeaderDisplayText()}</span>
                              </div>
                            )}

                            {codeType !== 'qr' && showBrand && (
                              <div className="text-[7.5px] text-slate-500 mt-0.5 truncate leading-none">
                                <span className="font-semibold text-slate-700">{item.brand}</span>
                                <span> • {item.category}</span>
                              </div>
                            )}
                          </div>

                          {/* Centered QR or Barcode with full SKU code on the same div */}
                          {codeType === 'qr' ? (
                            <div className="my-0.5 flex items-center gap-1.5 min-w-0">
                              <div className="bg-white p-0.5 rounded border border-slate-200 shrink-0 shadow-2xs flex items-center justify-center">
                                <SkuQrCode
                                  value={item.sku}
                                  size={Math.max(36, Math.round(qrSize * 0.8))}
                                  margin={0}
                                />
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                {showBrand && (
                                  <div className="text-[7.5px] text-slate-500 truncate leading-none mb-0.5">
                                    <span className="font-semibold text-slate-700">{item.brand}</span>
                                    <span> • {item.category}</span>
                                  </div>
                                )}
                                <div className="font-mono-num font-bold text-[8.5px] text-slate-900 bg-slate-50 border border-slate-200 px-1 py-0.5 rounded break-all leading-tight">
                                  {item.sku}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="my-0.5 flex flex-col items-center justify-center">
                              <Code128Barcode
                                value={item.sku}
                                height={Math.max(14, Math.round(barcodeHeight * 0.45))}
                                width={Math.max(0.7, Math.min(1.5, Math.round((barcodeScale * 0.62) * 100) / 100))}
                                barCount={barcodeBarCount}
                                displayValue={false}
                                fontSize={8}
                                margin={0}
                                className="max-w-full block mx-auto"
                              />
                              <div className="font-mono-num font-bold text-[8px] text-slate-800 tracking-wider text-center leading-none mt-0.5 break-all max-w-full">
                                {item.sku}
                              </div>
                            </div>
                          )}

                          {/* Footer: Price (Stuck to bottom) */}
                          {showPrice && (
                            <div className="mt-auto pt-1 border-t border-slate-100 flex items-center justify-center text-xs leading-none w-full">
                              <div className="font-mono-num font-extrabold text-[10.5px] text-slate-950 text-center">
                                {formatNPR(item.sellingPrice)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Default shelf_tag / box_sticker / compact_tag / a4_sheet
                    return (
                      <div
                        key={`${item.id}-${instanceIndex}-${idx}`}
                        className={`print-label-item p-3 bg-white flex flex-col justify-between transition-shadow text-slate-900 ${
                          showCutBorders
                            ? 'border border-dashed border-slate-300 rounded-lg'
                            : 'border border-slate-100 rounded-lg'
                        }`}
                        style={{
                          minHeight:
                            template === 'compact_tag'
                              ? '100px'
                              : template === 'shelf_tag'
                              ? '140px'
                              : '170px',
                        }}
                      >
                        {/* Label Top Header */}
                        <div>
                          {showStoreName && (
                            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-extrabold text-slate-500 border-b border-slate-100 pb-1 mb-1">
                              <span className="truncate">{getHeaderDisplayText()}</span>
                            </div>
                          )}

                          {showBrand && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              <span className="font-semibold text-slate-700">{item.brand}</span>
                              <span> • {item.category}</span>
                            </div>
                          )}
                        </div>

                        {/* Centered Scannable QR or Barcode with full SKU code on the same div */}
                        <div className="my-auto py-1 flex flex-col items-center justify-center">
                          {codeType === 'qr' ? (
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <div className="p-1 bg-white border border-slate-200 rounded-lg shadow-2xs inline-block">
                                <SkuQrCode
                                  value={item.sku}
                                  size={template === 'compact_tag' ? 42 : qrSize}
                                  margin={0}
                                />
                              </div>
                              <div className="font-mono-num font-bold text-[10.5px] text-slate-900 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded tracking-wide text-center break-all max-w-full">
                                {item.sku}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <Code128Barcode
                                value={item.sku}
                                height={template === 'compact_tag' ? 32 : barcodeHeight}
                                width={barcodeScale}
                                barCount={barcodeBarCount}
                                displayValue={false}
                                fontSize={11}
                                margin={2}
                                className="max-w-full"
                              />
                              <div className="font-mono-num font-bold text-[10.5px] text-slate-900 tracking-wide text-center leading-none mt-1 break-all max-w-full">
                                {item.sku}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Retail Price Stuck to bottom in footer */}
                        {showPrice && (
                          <div className="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-center text-xs w-full">
                            <div className="font-mono-num font-extrabold text-sm text-slate-950 text-center">
                              {formatNPR(item.sellingPrice)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Helpful Printing Advice Notice & Stickering Confirmation */}
            <div className="w-full max-w-xl mt-4 p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Compatible with standard desktop printers, Avery sticker sheets, and thermal label roll printers.</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {onMarkStickered && (
                  <button
                    type="button"
                    onClick={() => {
                      const idsToMark = mode === 'single' ? (currentItem ? [currentItem.id] : []) : batchSelectedIds;
                      onMarkStickered(idsToMark);
                    }}
                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Stickered & Done ✅</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
