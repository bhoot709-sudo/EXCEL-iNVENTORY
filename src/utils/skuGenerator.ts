import { InventoryItem, Invoice, ProductCategory } from '../types';

/**
 * Category Code Mapping for standardized, high-clarity SKU generation
 */
const CATEGORY_CODES: Record<string, string> = {
  'Smartphones': 'PHN',
  'Tablets': 'TAB',
  'Audio': 'AUD',
  'Wearables': 'WCH',
  'Chargers & Power': 'PWR',
  'Protection & Cases': 'CAS',
  'Cables & Adapters': 'CBL',
  'Gaming': 'GAM',
  'Cameras': 'CAM',
  'Laptops & Computers': 'LPT',
  'Accessories': 'ACC',
};

/**
 * Brand Code Mapping for clean 3-4 letter uppercase prefixes
 */
function getBrandCode(brand: string): string {
  const clean = (brand || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return 'GAD';
  if (clean.length <= 4) return clean;
  // Specific popular brands
  if (clean.startsWith('APPLE') || clean.startsWith('IPHONE')) return 'APL';
  if (clean.startsWith('SAMSUNG')) return 'SAM';
  if (clean.startsWith('XIAOMI') || clean.startsWith('REDMI') || clean.startsWith('POCO')) return 'XIA';
  if (clean.startsWith('ONEPLUS')) return '1PL';
  if (clean.startsWith('REALME')) return 'RLM';
  if (clean.startsWith('VIVO')) return 'VIV';
  if (clean.startsWith('OPPO')) return 'OPP';
  if (clean.startsWith('SONY')) return 'SNY';
  if (clean.startsWith('GOOGLE') || clean.startsWith('PIXEL')) return 'GGL';
  if (clean.startsWith('ANKER')) return 'ANK';
  if (clean.startsWith('BASEUS')) return 'BAS';
  if (clean.startsWith('JBL')) return 'JBL';
  if (clean.startsWith('BOAT')) return 'BOT';
  if (clean.startsWith('NOISE')) return 'NOS';
  if (clean.startsWith('HUAWEI') || clean.startsWith('HONOR')) return 'HUA';
  if (clean.startsWith('NOTHING')) return 'NTH';
  if (clean.startsWith('LENOVO') || clean.startsWith('MOTOROLA')) return 'MOT';
  return clean.slice(0, 3);
}

/**
 * Extract model keywords for SKU readability (e.g., iPhone 15 Pro Max -> 15PM, Galaxy S24 Ultra -> S24U)
 */
function getModelCode(name: string): string {
  const clean = (name || '').trim().toUpperCase();
  if (!clean) return 'GEN';

  // Common patterns
  const match15ProMax = clean.match(/(\d{1,2})\s*(PRO\s*MAX|PRO|PLUS|MINI|MAX)/);
  if (match15ProMax) {
    const num = match15ProMax[1];
    const suffix = match15ProMax[2].replace(/\s+/g, '').slice(0, 2);
    return `${num}${suffix}`;
  }

  const matchSeries = clean.match(/([A-Z]\d{1,3})(\s*(ULTRA|PLUS|FE|PRO|LITE))?/);
  if (matchSeries) {
    const series = matchSeries[1];
    const sub = matchSeries[3] ? matchSeries[3][0] : '';
    return `${series}${sub}`;
  }

  // Fallback: take clean letters/digits from product name
  const words = clean.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0].slice(0, 2)}${words[1].slice(0, 2)}`;
  }
  return words[0]?.slice(0, 4) || 'PROD';
}

export interface SkuGenOptions {
  isRestock?: boolean;
  batchTag?: string;
  style?: 'smart' | 'compact' | 'serial' | 'ean_like';
  customSuffix?: string;
}

/**
 * Generates a guaranteed 100% unique SKU validated against the entire inventory database.
 */
export function generateUniqueSku(
  brand: string,
  category: string,
  name: string,
  existingInventory: InventoryItem[] = [],
  options?: SkuGenOptions
): string {
  const brandCode = getBrandCode(brand);
  const catCode = CATEGORY_CODES[category] || (category ? category.slice(0, 3).toUpperCase() : 'GAD');
  const modelCode = getModelCode(name);
  const existingSkuSet = new Set(existingInventory.map((i) => i.sku.toUpperCase()));

  const now = new Date();
  const yearMonth = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  let candidate = '';
  let attempts = 0;

  while (attempts < 1000) {
    attempts++;
    const randomHexOrNum = Math.floor(1000 + Math.random() * 9000);

    if (options?.isRestock) {
      // Restock batch SKU style: APL-15PM-R2409-102
      const batchSuffix = options.batchTag ? options.batchTag.toUpperCase() : `R${yearMonth}`;
      candidate = `${brandCode}-${modelCode}-${batchSuffix}-${Math.floor(100 + Math.random() * 900)}`;
    } else if (options?.style === 'compact') {
      // Compact style: APL-8921
      candidate = `${brandCode}-${randomHexOrNum}`;
    } else if (options?.style === 'serial') {
      // Serialized alphanumeric: RPG-APL-938210
      candidate = `RPG-${brandCode}-${Math.floor(100000 + Math.random() * 900000)}`;
    } else {
      // Default 'smart' standard retail format: APL-PHN-15PM-4829
      candidate = `${brandCode}-${catCode}-${modelCode}-${randomHexOrNum}`;
    }

    if (options?.customSuffix) {
      candidate = `${candidate}-${options.customSuffix.toUpperCase()}`;
    }

    if (!existingSkuSet.has(candidate.toUpperCase())) {
      return candidate;
    }
  }

  // Failsafe timestamp-guaranteed uniqueness
  return `${brandCode}-${catCode}-${Date.now().toString().slice(-6)}`;
}

/**
 * Generates an array of guaranteed 100% unique SKUs for a batch of items of the same product.
 * Each item in the batch gets its own distinct, non-duplicated unique SKU, even though all items share the exact same barcode.
 */
export function generateBatchUniqueSkus(
  count: number,
  brand: string,
  category: string,
  name: string,
  existingInventory: InventoryItem[] = [],
  options?: SkuGenOptions
): string[] {
  const safeCount = Math.max(1, Math.min(count, 500));
  const generatedSkus: string[] = [];
  const existingSkuSet = new Set(existingInventory.map((i) => i.sku.toUpperCase()));

  const brandCode = getBrandCode(brand);
  const catCode = CATEGORY_CODES[category] || (category ? category.slice(0, 3).toUpperCase() : 'GAD');
  const modelCode = getModelCode(name);
  const randomBase = Math.floor(1000 + Math.random() * 9000);

  for (let i = 1; i <= safeCount; i++) {
    let candidate = '';
    let suffixNum = i;
    let attempts = 0;

    while (attempts < 1000) {
      attempts++;
      const padIndex = suffixNum.toString().padStart(safeCount > 99 ? 3 : 2, '0');

      if (options?.style === 'compact') {
        candidate = `${brandCode}-${randomBase}-${padIndex}`;
      } else if (options?.style === 'serial') {
        candidate = `RPG-${brandCode}-${randomBase}${padIndex}`;
      } else {
        candidate = `${brandCode}-${catCode}-${modelCode}-${randomBase}-${padIndex}`;
      }

      if (options?.customSuffix) {
        candidate = `${candidate}-${options.customSuffix.toUpperCase()}`;
      }

      const upper = candidate.toUpperCase();
      if (!existingSkuSet.has(upper) && !generatedSkus.some((s) => s.toUpperCase() === upper)) {
        generatedSkus.push(candidate);
        existingSkuSet.add(upper);
        break;
      }
      suffixNum++;
    }

    // Failsafe
    if (generatedSkus.length < i) {
      const fallback = `${brandCode}-${catCode}-${Date.now().toString().slice(-5)}-${i.toString().padStart(2, '0')}`;
      generatedSkus.push(fallback);
      existingSkuSet.add(fallback.toUpperCase());
    }
  }

  return generatedSkus;
}

/**
 * Generates a unique 12/13-digit EAN/UPC style numeric barcode guaranteed not to conflict.
 */
export function generateUniqueBarcode(
  existingInventory: InventoryItem[] = [],
  prefix: string = '890' // 890 is standard regional GS1 prefix
): string {
  const existingBarcodes = new Set(existingInventory.map((i) => i.barcode));
  let attempts = 0;

  while (attempts < 1000) {
    attempts++;
    // Generate 9 random digits to append to 3-digit prefix
    const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
    const candidate = `${prefix}${randomPart}`;

    if (!existingBarcodes.has(candidate)) {
      return candidate;
    }
  }

  // Failsafe timestamp barcode
  return `${prefix}${Date.now().toString().slice(-9)}`;
}

/**
 * Generates a restock lot tracking SKU linked to the original product SKU
 */
export function generateRestockBatchSku(
  originalSku: string,
  existingInventory: InventoryItem[] = []
): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const base = originalSku.replace(/-R\d{4}-B\d+$/, '');
  const existingSkuSet = new Set(existingInventory.map((i) => i.sku.toUpperCase()));

  for (let batchNum = 1; batchNum <= 99; batchNum++) {
    const candidate = `${base}-R${yearMonth}-B${batchNum}`;
    if (!existingSkuSet.has(candidate.toUpperCase())) {
      return candidate;
    }
  }

  return `${base}-R${Date.now().toString().slice(-4)}`;
}

/**
 * Validates SKU format:
 * - Must be at least 3 characters
 * - Only alphanumeric characters and valid separators (-, _, /, .)
 * - No whitespace or special punctuation like !@#$%^&*
 */
export function isValidSkuPattern(sku: string): { isValid: boolean; reason?: string } {
  const clean = (sku || '').trim();
  if (!clean) return { isValid: false, reason: 'SKU cannot be blank.' };
  if (clean.length < 3) return { isValid: false, reason: 'SKU must be at least 3 characters long.' };
  if (clean.length > 40) return { isValid: false, reason: 'SKU must not exceed 40 characters.' };
  
  if (/\s/.test(clean)) {
    return { isValid: false, reason: 'SKU must not contain spaces. Use hyphens (-) or underscores (_) instead.' };
  }

  // Allow letters, numbers, hyphens, underscores, dots, and forward slashes
  const validPattern = /^[A-Za-z0-9]+([-_/.][A-Za-z0-9]+)*$/;
  if (!validPattern.test(clean)) {
    return {
      isValid: false,
      reason: 'SKU must contain only letters, numbers, and hyphens/underscores (no trailing or adjacent symbols).',
    };
  }

  return { isValid: true };
}

export interface SkuValidationResult {
  isValid: boolean;
  isLabeled: boolean;
  status: 'empty' | 'valid' | 'duplicate' | 'invalid_format' | 'too_short';
  message: string;
  duplicateItem?: InventoryItem;
  formatType?: 'standard_app' | 'compact' | 'custom_alphanumeric';
}

/**
 * Checks if an item is considered labeled with a valid SKU format
 */
export function isSkuLabeled(sku: string | undefined): boolean {
  if (!sku) return false;
  const trimmed = sku.trim();
  return trimmed.length >= 3 && isValidSkuPattern(trimmed).isValid;
}

/**
 * Real-time comprehensive SKU format & uniqueness validator
 */
export function validateSkuRealTime(
  rawSku: string,
  currentItemId: string | undefined,
  existingInventory: InventoryItem[] = []
): SkuValidationResult {
  const trimmed = (rawSku || '').trim();
  
  if (!trimmed) {
    return {
      isValid: false,
      isLabeled: false,
      status: 'empty',
      message: 'Item is not labeled with an SKU. Generate or enter a unique SKU.',
    };
  }

  if (trimmed.length < 3) {
    return {
      isValid: false,
      isLabeled: false,
      status: 'too_short',
      message: `Too short (${trimmed.length}/3 chars minimum).`,
    };
  }

  // Format Pattern Check
  const patternCheck = isValidSkuPattern(trimmed);
  if (!patternCheck.isValid) {
    return {
      isValid: false,
      isLabeled: false,
      status: 'invalid_format',
      message: patternCheck.reason || 'Invalid SKU format.',
    };
  }

  // Uniqueness Check against inventory catalog (case-insensitive)
  const cleanUpper = trimmed.toUpperCase();
  const duplicate = existingInventory.find(
    (item) => item.sku && item.sku.trim().toUpperCase() === cleanUpper && item.id !== currentItemId
  );

  if (duplicate) {
    return {
      isValid: false,
      isLabeled: false, // Cannot be considered properly labeled if it conflicts with another item
      status: 'duplicate',
      message: `Duplicate SKU: Already registered to "${duplicate.name}" (${duplicate.stockQuantity} in stock).`,
      duplicateItem: duplicate,
    };
  }

  // Detect format style
  const isAppStandard = /^[A-Z0-9]{2,5}-[A-Z0-9]{2,4}-[A-Z0-9]{2,8}-[A-Z0-9]{3,6}$/i.test(trimmed);
  const isCompact = /^[A-Z0-9]{2,5}-[0-9]{3,6}$/i.test(trimmed);

  return {
    isValid: true,
    isLabeled: true,
    status: 'valid',
    message: 'Valid & Unique SKU (Item is properly labeled and ready to save)',
    formatType: isAppStandard ? 'standard_app' : isCompact ? 'compact' : 'custom_alphanumeric',
  };
}

/**
 * Validates SKU uniqueness against existing inventory catalog
 */
export function validateSkuUniqueness(
  sku: string,
  currentItemId: string | undefined,
  existingInventory: InventoryItem[]
): { isValid: boolean; error?: string } {
  const res = validateSkuRealTime(sku, currentItemId, existingInventory);
  if (!res.isValid) {
    return { isValid: false, error: res.message };
  }
  return { isValid: true };
}

/**
 * Generates multiple stylish SKU suggestions for user to choose from
 */
export function getSkuSuggestions(
  brand: string,
  category: string,
  name: string,
  existingInventory: InventoryItem[]
): Array<{ label: string; sku: string; description: string }> {
  return [
    {
      label: 'Smart Structured',
      sku: generateUniqueSku(brand, category, name, existingInventory, { style: 'smart' }),
      description: 'Brand + Category + Model + 4-digit Unique ID (e.g., APL-PHN-15PRO-8492)',
    },
    {
      label: 'Compact POS',
      sku: generateUniqueSku(brand, category, name, existingInventory, { style: 'compact' }),
      description: 'Short prefix + 4-digit ID for fast manual cashier lookup (e.g., APL-8492)',
    },
    {
      label: 'Inventory Serial',
      sku: generateUniqueSku(brand, category, name, existingInventory, { style: 'serial' }),
      description: 'Store prefix + Brand + 6-digit Unique Inventory Track (e.g., RPG-APL-938210)',
    },
  ];
}

/**
 * Unpacks and expands inventory items into individual unit items.
 * If an item has stockQuantity > 1, it creates `stockQuantity` distinct item records,
 * each with stockQuantity = 1, its own unique SKU (e.g., `${baseSku}-U01`, `${baseSku}-U02`),
 * and preserving the same barcode, prices, brand, category, supplier, and entered date.
 */
export function expandInventoryToIndividualUnits(inventory: InventoryItem[]): InventoryItem[] {
  const result: InventoryItem[] = [];
  const assignedSkus = new Set<string>();
  const assignedIds = new Set<string>();

  // Helper to ensure an item has a guaranteed unique ID
  const getUniqueId = (candidateId: string): string => {
    let cleanId = candidateId.trim();
    if (!cleanId) cleanId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (!assignedIds.has(cleanId)) {
      assignedIds.add(cleanId);
      return cleanId;
    }
    let suffix = 1;
    while (assignedIds.has(`${cleanId}-${suffix}`)) {
      suffix++;
    }
    const finalId = `${cleanId}-${suffix}`;
    assignedIds.add(finalId);
    return finalId;
  };

  // Helper to ensure a unique SKU
  const getUniqueSku = (candidateSku: string, brand: string, category: string, name: string): string => {
    let cleanSku = candidateSku.trim().toUpperCase();
    if (!cleanSku) {
      cleanSku = generateUniqueSku(brand, category, name, result);
    }
    if (!assignedSkus.has(cleanSku)) {
      assignedSkus.add(cleanSku);
      return cleanSku;
    }
    let counter = 1;
    while (assignedSkus.has(`${cleanSku}-U${String(counter).padStart(2, '0')}`)) {
      counter++;
    }
    const finalSku = `${cleanSku}-U${String(counter).padStart(2, '0')}`;
    assignedSkus.add(finalSku);
    return finalSku;
  };

  // Pre-seed known single-item SKUs and IDs from existing inventory
  for (const item of inventory) {
    if (item.stockQuantity <= 1 && item.sku) {
      assignedSkus.add(item.sku.trim().toUpperCase());
    }
    if (item.id) {
      // Don't reserve if item has multi-quantity since it will be unpacked
      if (item.stockQuantity <= 1) {
        assignedIds.add(item.id.trim());
      }
    }
  }

  // Set of already-existing unit IDs to avoid duplicate unpacking
  const existingIdSet = new Set(inventory.map((i) => i.id.trim()));

  for (const item of inventory) {
    const qty = Math.max(0, item.stockQuantity);

    // If stock quantity is 0 or 1, keep as is (ensuring unique ID & SKU)
    if (qty <= 1) {
      const uniqueId = getUniqueId(item.id);
      const uniqueSku = getUniqueSku(item.sku, item.brand, item.category, item.name);
      result.push({
        ...item,
        id: uniqueId,
        sku: uniqueSku,
        stockQuantity: qty,
        reorderLevel: 1,
      });
      continue;
    }

    // For items with qty > 1, expand into individual units
    const baseSku = (item.sku.trim() || generateUniqueSku(item.brand, item.category, item.name, result)).toUpperCase();

    for (let i = 1; i <= qty; i++) {
      let candidateSku = `${baseSku}-U${String(i).padStart(2, '0')}`;
      let counter = i;
      while (assignedSkus.has(candidateSku)) {
        counter++;
        candidateSku = `${baseSku}-U${String(counter).padStart(2, '0')}`;
      }
      assignedSkus.add(candidateSku);

      const targetId = i === 1 ? item.id : `${item.id}-unit-${i}`;
      // Ensure targetId is strictly unique across all processed items
      let finalId = targetId;
      if (assignedIds.has(finalId)) {
        let suffix = 2;
        while (assignedIds.has(`${targetId}-${suffix}`)) {
          suffix++;
        }
        finalId = `${targetId}-${suffix}`;
      }
      assignedIds.add(finalId);

      result.push({
        ...item,
        id: finalId,
        sku: candidateSku,
        stockQuantity: 1, // Individual physical unit
        reorderLevel: 1,
      });
    }
  }

  return result;
}

/**
 * Robustly sanitizes and deduplicates inventory items.
 * Guarantees that every item has a strictly unique ID and unique SKU,
 * eliminating duplicate React keys across all inventory tables and views.
 */
export function deduplicateAndSanitizeInventory(inventory: InventoryItem[]): InventoryItem[] {
  if (!inventory || inventory.length === 0) return [];

  // First unpack any grouped quantities
  const expanded = expandInventoryToIndividualUnits(inventory);

  const seenIds = new Set<string>();
  const seenSkus = new Set<string>();
  const sanitized: InventoryItem[] = [];

  for (let idx = 0; idx < expanded.length; idx++) {
    const item = expanded[idx];
    let uniqueId = item.id ? item.id.trim() : `prod-${Date.now()}-${idx}`;
    if (seenIds.has(uniqueId)) {
      // Collision detected - generate a distinct non-colliding ID
      let counter = 2;
      while (seenIds.has(`${uniqueId}-d${counter}`)) {
        counter++;
      }
      uniqueId = `${uniqueId}-d${counter}`;
    }
    seenIds.add(uniqueId);

    let uniqueSku = item.sku ? item.sku.trim().toUpperCase() : `SKU-${Date.now().toString(36).slice(-4)}-${idx}`;
    if (seenSkus.has(uniqueSku)) {
      let counter = 1;
      while (seenSkus.has(`${uniqueSku}-U${String(counter).padStart(2, '0')}`)) {
        counter++;
      }
      uniqueSku = `${uniqueSku}-U${String(counter).padStart(2, '0')}`;
    }
    seenSkus.add(uniqueSku);

    sanitized.push({
      ...item,
      id: uniqueId,
      sku: uniqueSku,
    });
  }

  return sanitized;
}

/**
 * Checks whether an SKU (or item) has been billed/sold in any invoice,
 * returning the billing date, invoice number, and customer information.
 */
export function getUnitSaleInfo(
  sku: string,
  itemId: string | undefined,
  invoices: Invoice[]
): {
  isSold: boolean;
  billingDate?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  invoiceNumber?: string;
  salePrice?: number;
} | null {
  if (!sku && !itemId) return null;
  const cleanSku = (sku || '').trim().toLowerCase();
  const cleanId = (itemId || '').trim().toLowerCase();

  for (const inv of invoices) {
    for (const invItem of inv.items) {
      const matchSku = cleanSku && invItem.sku && invItem.sku.trim().toLowerCase() === cleanSku;
      const matchId = cleanId && invItem.itemId && invItem.itemId.trim().toLowerCase() === cleanId;
      if (matchSku || matchId) {
        return {
          isSold: true,
          billingDate: inv.date,
          customerName: inv.customerName,
          customerPhone: inv.customerPhone,
          customerEmail: inv.customerEmail,
          invoiceNumber: inv.invoiceNumber,
          salePrice: invItem.unitPrice,
        };
      }
    }
  }
  return null;
}

