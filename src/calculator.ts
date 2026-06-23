export type Unit = 'won' | 'thousand' | 'million';
export type Basis = 'direct' | 'total';

export interface PersonnelRow {
  id: number;
  name: string;
  pos?: string;
  base: string;
  months: string;
  counted?: boolean;
}

export interface BudgetYear {
  name: string;
  totalRaw: string;
  rateRaw: string;
  allowanceRateRaw: string;
  vat: boolean;
  basis: Basis;
  internal: PersonnelRow[];
  external: PersonnelRow[];
  student: PersonnelRow[];
  activityRaw: string;
  materialRaw: string;
}

export interface BudgetAllocation {
  direct: number;
  indirect: number;
  vatAmt: number;
  required: number;
}

export interface ComputedBudget {
  intCounted: number;
  intAll: number;
  ext: number;
  stu: number;
  personnelCounted: number;
  personnelAll: number;
  allowance: number;
  activity: number;
  material: number;
  direct: number;
  indirect: number;
  vatAmt: number;
  required: number;
  total: number;
  diff: number;
  targetDirect: number;
  targetIndirect: number;
  targetVatAmt: number;
}

export const positions: Record<string, number> = {
  '학사과정': 1200,
  '석사과정': 2200,
  '박사과정': 3000,
  '조교수': 7000,
  '부교수': 8000,
  '정교수': 9000,
  '박사급연구원': 7000,
  '석사급연구원': 4000,
  '학사급연구원': 3000,
};

export function parseNum(value: string | number | undefined): number {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function unitName(unit: Unit): string {
  if (unit === 'won') return '원';
  if (unit === 'million') return '백만원';
  return '천원';
}

export function rowAmount(row: PersonnelRow): number {
  return parseNum(row.base) * parseNum(row.months);
}

export function newYear(name: string, overrides: Partial<BudgetYear> = {}): BudgetYear {
  return {
    name,
    totalRaw: '100000',
    rateRaw: '',
    allowanceRateRaw: '',
    vat: false,
    basis: 'direct',
    internal: [],
    external: [],
    student: [],
    activityRaw: '',
    materialRaw: '',
    ...overrides,
  };
}

export function allocateTotalBudget(y: BudgetYear): BudgetAllocation {
  const total = Math.round(parseNum(y.totalRaw));
  const r = parseNum(y.rateRaw) / 100;
  if (total <= 0) return { direct: 0, indirect: 0, vatAmt: 0, required: 0 };

  const net = y.vat ? Math.round(total / 1.1) : total;
  const vatAmt = y.vat ? total - net : 0;
  let direct: number;
  let indirect: number;
  if (y.basis === 'direct') {
    direct = r > -1 ? Math.round(net / (1 + r)) : net;
    indirect = net - direct;
  } else {
    indirect = Math.round(net * r);
    direct = net - indirect;
  }
  return { direct, indirect, vatAmt, required: total };
}

export function computeBudget(y: BudgetYear): ComputedBudget {
  const intCounted = y.internal.filter((row) => row.counted).reduce((a, b) => a + rowAmount(b), 0);
  const intAll = y.internal.reduce((a, b) => a + rowAmount(b), 0);
  const ext = y.external.reduce((a, b) => a + rowAmount(b), 0);
  const stu = y.student.reduce((a, b) => a + rowAmount(b), 0);
  const personnelCounted = intCounted + ext + stu;
  const personnelAll = intAll + ext + stu;
  const allowance = (personnelAll * parseNum(y.allowanceRateRaw)) / 100;
  const activity = parseNum(y.activityRaw);
  const material = parseNum(y.materialRaw);
  const rawDirect = personnelCounted + allowance + activity + material;
  const direct = Math.round(rawDirect);
  const r = parseNum(y.rateRaw) / 100;
  let indirect = Math.round(y.basis === 'direct' ? direct * r : r < 1 ? (direct * r) / (1 - r) : 0);
  let preVat = direct + indirect;
  let vatAmt = y.vat ? Math.round(preVat * 0.1) : 0;
  let required = preVat + vatAmt;
  const total = Math.round(parseNum(y.totalRaw));
  const roundedGap = total - required;
  if (total > 0 && Math.abs(roundedGap) <= 1) {
    indirect += roundedGap;
    preVat = direct + indirect;
    vatAmt = y.vat ? total - preVat : 0;
    required = total;
  }
  const target = allocateTotalBudget(y);
  return {
    intCounted,
    intAll,
    ext,
    stu,
    personnelCounted,
    personnelAll,
    allowance,
    activity,
    material,
    direct,
    indirect,
    vatAmt,
    required,
    total,
    diff: total - required,
    targetDirect: target.direct,
    targetIndirect: target.indirect,
    targetVatAmt: target.vatAmt,
  };
}

export function activityToBalance(y: BudgetYear): number {
  const c = computeBudget(y);
  const target = allocateTotalBudget(y);
  const baseExclActivity = c.personnelCounted + c.allowance + c.material;
  return Math.max(0, Math.round(target.direct - baseExclActivity));
}

export function grandTotals(years: BudgetYear[]) {
  const totals = years.reduce(
    (acc, year) => {
      const c = computeBudget(year);
      acc.required += c.required;
      acc.total += c.total;
      return acc;
    },
    { required: 0, total: 0 },
  );
  return { ...totals, diff: totals.total - totals.required };
}
