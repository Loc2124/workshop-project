export interface ParsedVietQr {
  bin?: string;
  accountNumber?: string;
  description?: string;
}

/**
 * Parses an EMVCo VietQR string to extract beneficiary bank BIN,
 * account number, and transaction description.
 */
export function parseVietQrPayload(
  qrString?: string | null,
): ParsedVietQr | null {
  if (!qrString || typeof qrString !== 'string') return null;
  if (!qrString.startsWith('000201')) return null;

  try {
    let i = 0;
    let tag38: string | null = null;
    let tag62: string | null = null;

    while (i + 4 <= qrString.length) {
      const tag = qrString.substring(i, i + 2);
      const len = parseInt(qrString.substring(i + 2, i + 4), 10);
      if (isNaN(len) || i + 4 + len > qrString.length) break;
      const val = qrString.substring(i + 4, i + 4 + len);
      i += 4 + len;

      if (tag === '38') tag38 = val;
      if (tag === '62') tag62 = val;
    }

    if (!tag38) return null;

    let bin: string | undefined;
    let accountNumber: string | undefined;
    let j = 0;

    while (j + 4 <= tag38.length) {
      const sTag = tag38.substring(j, j + 2);
      const sLen = parseInt(tag38.substring(j + 2, j + 4), 10);
      if (isNaN(sLen) || j + 4 + sLen > tag38.length) break;
      const sVal = tag38.substring(j + 4, j + 4 + sLen);
      j += 4 + sLen;

      if (sTag === '01') {
        let k = 0;
        while (k + 4 <= sVal.length) {
          const ssTag = sVal.substring(k, k + 2);
          const ssLen = parseInt(sVal.substring(k + 2, k + 4), 10);
          if (isNaN(ssLen) || k + 4 + ssLen > sVal.length) break;
          const ssVal = sVal.substring(k + 4, k + 4 + ssLen);
          k += 4 + ssLen;

          if (ssTag === '00') bin = ssVal;
          if (ssTag === '01') accountNumber = ssVal;
        }
      }
    }

    let description: string | undefined;
    if (tag62) {
      let m = 0;
      while (m + 4 <= tag62.length) {
        const dTag = tag62.substring(m, m + 2);
        const dLen = parseInt(tag62.substring(m + 2, m + 4), 10);
        if (isNaN(dLen) || m + 4 + dLen > tag62.length) break;
        const dVal = tag62.substring(m + 4, m + 4 + dLen);
        m += 4 + dLen;

        if (dTag === '08') description = dVal;
      }
    }

    return { bin, accountNumber, description };
  } catch {
    return null;
  }
}
