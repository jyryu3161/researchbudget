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
    totalRaw: '',
    rateRaw: '26.09',
    allowanceRateRaw: '20',
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
  const direct = personnelCounted + allowance + activity + material;
  const r = parseNum(y.rateRaw) / 100;
  const indirect = y.basis === 'direct' ? direct * r : r < 1 ? (direct * r) / (1 - r) : 0;
  const preVat = direct + indirect;
  const vatAmt = y.vat ? preVat * 0.1 : 0;
  const required = preVat + vatAmt;
  const total = parseNum(y.totalRaw);
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
  };
}

export function activityToBalance(y: BudgetYear): number {
  const c = computeBudget(y);
  const total = c.total;
  const r = parseNum(y.rateRaw) / 100;
  const indirectMultiplier = y.basis === 'direct' ? 1 + r : r < 1 ? 1 / (1 - r) : 1;
  const vatMultiplier = y.vat ? 1.1 : 1;
  const targetDirect = total / (indirectMultiplier * vatMultiplier);
  const baseExclActivity = c.personnelCounted + c.allowance + c.material;
  return Math.max(0, Math.round(targetDirect - baseExclActivity));
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
