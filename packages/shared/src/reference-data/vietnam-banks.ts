export interface BankInfo {
  bin: string;
  code: string;
  shortName: string;
  name: string;
}

export const VIETNAM_BANKS: readonly BankInfo[] = [
  // Big 4 & Ngân hàng thương mại lớn
  {
    bin: '970436',
    code: 'VCB',
    shortName: 'Vietcombank',
    name: 'TMCP Ngoại thương Việt Nam',
  },
  {
    bin: '970415',
    code: 'CTG',
    shortName: 'VietinBank',
    name: 'TMCP Công thương Việt Nam',
  },
  {
    bin: '970418',
    code: 'BIDV',
    shortName: 'BIDV',
    name: 'TMCP Đầu tư và Phát triển Việt Nam',
  },
  {
    bin: '970405',
    code: 'VBA',
    shortName: 'Agribank',
    name: 'Nông nghiệp & PT Nông thôn VN',
  },
  { bin: '970422', code: 'MB', shortName: 'MBBank', name: 'TMCP Quân đội' },
  {
    bin: '970407',
    code: 'TCB',
    shortName: 'Techcombank',
    name: 'TMCP Kỹ thương Việt Nam',
  },
  { bin: '970416', code: 'ACB', shortName: 'ACB', name: 'TMCP Á Châu' },
  {
    bin: '970432',
    code: 'VPB',
    shortName: 'VPBank',
    name: 'TMCP Việt Nam Thịnh Vượng',
  },
  { bin: '970423', code: 'TPB', shortName: 'TPBank', name: 'TMCP Tiên Phong' },
  {
    bin: '970403',
    code: 'STB',
    shortName: 'Sacombank',
    name: 'TMCP Sài Gòn Thương Tín',
  },
  {
    bin: '970437',
    code: 'HDB',
    shortName: 'HDBank',
    name: 'TMCP Phát triển TP.HCM',
  },
  {
    bin: '970441',
    code: 'VIB',
    shortName: 'VIB',
    name: 'TMCP Quốc tế Việt Nam',
  },
  {
    bin: '970443',
    code: 'SHB',
    shortName: 'SHB',
    name: 'TMCP Sài Gòn - Hà Nội',
  },
  {
    bin: '970426',
    code: 'MSB',
    shortName: 'MSB',
    name: 'TMCP Hàng Hải Việt Nam',
  },
  { bin: '970448', code: 'OCB', shortName: 'OCB', name: 'TMCP Phương Đông' },
  {
    bin: '970449',
    code: 'LPB',
    shortName: 'LPBank',
    name: 'TMCP Lộc Phát Việt Nam (LPBank)',
  },
  {
    bin: '970440',
    code: 'SEAB',
    shortName: 'SeABank',
    name: 'TMCP Đông Nam Á',
  },
  {
    bin: '970431',
    code: 'EIB',
    shortName: 'Eximbank',
    name: 'TMCP Xuất Nhập khẩu Việt Nam',
  },
  { bin: '970428', code: 'NAB', shortName: 'Nam A Bank', name: 'TMCP Nam Á' },
  {
    bin: '970400',
    code: 'SGB',
    shortName: 'SaigonBank',
    name: 'TMCP Sài Gòn Công Thương',
  },
  { bin: '970425', code: 'ABB', shortName: 'ABBANK', name: 'TMCP An Bình' },
  { bin: '970409', code: 'BAB', shortName: 'Bac A Bank', name: 'TMCP Bắc Á' },
  { bin: '970419', code: 'NCB', shortName: 'NCB', name: 'TMCP Quốc Dân' },
  {
    bin: '970452',
    code: 'KLB',
    shortName: 'Kienlongbank',
    name: 'TMCP Kiên Long',
  },
  { bin: '970427', code: 'VAB', shortName: 'VietABank', name: 'TMCP Việt Á' },
  { bin: '970454', code: 'BVB', shortName: 'BVBank', name: 'TMCP Bản Việt' },
  {
    bin: '970438',
    code: 'BVBANK',
    shortName: 'BaoVietBank',
    name: 'TMCP Bảo Việt',
  },
  {
    bin: '970430',
    code: 'PGB',
    shortName: 'PGBank',
    name: 'TMCP Thịnh vượng và Phát triển',
  },
  {
    bin: '970412',
    code: 'PVCB',
    shortName: 'PVcomBank',
    name: 'TMCP Đại Chúng Việt Nam',
  },
  { bin: '970406', code: 'DOB', shortName: 'DongA Bank', name: 'TMCP Đông Á' },
  // Ngân hàng số & Ví
  {
    bin: '546034',
    code: 'CAKE',
    shortName: 'CAKE by VPBank',
    name: 'Ngân hàng số CAKE by VPBank',
  },
  {
    bin: '546035',
    code: 'UBANK',
    shortName: 'Ubank by VPBank',
    name: 'Ngân hàng số Ubank by VPBank',
  },
  {
    bin: '963369',
    code: 'LIOBANK',
    shortName: 'Liobank',
    name: 'Ngân hàng số Liobank by OCB',
  },
  {
    bin: '971005',
    code: 'VTLMONEY',
    shortName: 'Viettel Money',
    name: 'Tổng Công ty Dịch vụ Số Viettel',
  },
  {
    bin: '801012',
    code: 'VNPTMONEY',
    shortName: 'VNPT Money',
    name: 'Tập đoàn Bưu chính Viễn thông VNPT',
  },
  // Ngân hàng ngoại & liên doanh
  {
    bin: '970433',
    code: 'SHBVN',
    shortName: 'Shinhan Bank',
    name: 'TNHH MTV Shinhan Việt Nam',
  },
  {
    bin: '458761',
    code: 'HSBC',
    shortName: 'HSBC',
    name: 'TNHH MTV HSBC Việt Nam',
  },
  {
    bin: '970410',
    code: 'SCVN',
    shortName: 'Standard Chartered',
    name: 'TNHH MTV Standard Chartered VN',
  },
  { bin: '970429', code: 'SCB', shortName: 'SCB', name: 'TMCP Sài Gòn' },
  {
    bin: '970446',
    code: 'COOPBANK',
    shortName: 'Co-opBank',
    name: 'Hợp tác xã Việt Nam',
  },
  {
    bin: '422589',
    code: 'CIMB',
    shortName: 'CIMB',
    name: 'TNHH MTV CIMB Việt Nam',
  },
  {
    bin: '668888',
    code: 'KBANK',
    shortName: 'KBank',
    name: 'Đại chúng TNHH Kasikornbank - CN TP.HCM',
  },
  {
    bin: '970439',
    code: 'PBVN',
    shortName: 'PublicBank',
    name: 'TNHH MTV Public Việt Nam',
  },
  {
    bin: '970434',
    code: 'IVB',
    shortName: 'IndovinaBank',
    name: 'TNHH Indovina',
  },
  {
    bin: '970421',
    code: 'VRB',
    shortName: 'VRB',
    name: 'Liên doanh Việt - Nga',
  },
  {
    bin: '970457',
    code: 'WVN',
    shortName: 'Woori Bank',
    name: 'TNHH MTV Woori Việt Nam',
  },
  {
    bin: '970458',
    code: 'UOB',
    shortName: 'UOB',
    name: 'TNHH MTV United Overseas Bank VN',
  },
  {
    bin: '970455',
    code: 'IBK',
    shortName: 'IBK - HCM',
    name: 'Công nghiệp Hàn Quốc - CN TP.HCM',
  },
  {
    bin: '970456',
    code: 'IBKHN',
    shortName: 'IBK - HN',
    name: 'Công nghiệp Hàn Quốc - CN Hà Nội',
  },
  {
    bin: '970442',
    code: 'HLBVN',
    shortName: 'Hong Leong',
    name: 'TNHH MTV Hong Leong Việt Nam',
  },
];

export function getBankByBin(bin?: string | null): BankInfo | undefined {
  if (!bin) return undefined;
  return VIETNAM_BANKS.find((b) => b.bin === bin);
}

export function formatBankDisplay(
  bin?: string | null,
  fallbackName?: string | null,
): string {
  const bank = getBankByBin(bin);
  if (bank) {
    return `${bank.shortName} (${bank.code})`;
  }
  return fallbackName || (bin ? `Mã NH ${bin}` : 'Ngân hàng');
}
