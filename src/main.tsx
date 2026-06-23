import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BudgetYear,
  PersonnelRow,
  Unit,
  activityToBalance,
  computeBudget,
  formatNumber,
  grandTotals,
  newYear,
  parseNum,
  positions,
  rowAmount,
  unitName,
} from './calculator';
import './styles.css';

const initialYears: BudgetYear[] = [
  newYear('1차년도', {
    totalRaw: '110000',
    rateRaw: '26.09',
    allowanceRateRaw: '20',
    vat: false,
    basis: 'direct',
    internal: [
      { id: 1, name: '이찬희', base: '800', months: '9', counted: true },
      { id: 2, name: '류재용', base: '2400', months: '9', counted: false },
    ],
    external: [],
    student: [{ id: 3, name: '홍길동', base: '2000', months: '9' }],
    activityRaw: '15000',
    materialRaw: '10000',
  }),
];

const presets = [
  { label: '국가R&D 주관·공동 26.09%', rate: '26.09', vat: false },
  { label: '국가R&D 위탁 22%', rate: '22', vat: true },
  { label: '정부용역 6%', rate: '6', vat: true },
  { label: '지자체용역 6%', rate: '6', vat: true },
  { label: '민간용역 18%', rate: '18', vat: true },
];

let uid = 100;

type Group = 'internal' | 'external' | 'student';

function App() {
  const [unit, setUnit] = useState<Unit>('thousand');
  const [years, setYears] = useState<BudgetYear[]>(initialYears);
  const [activeYear, setActiveYear] = useState(0);
  const year = years[activeYear];
  const computed = useMemo(() => computeBudget(year), [year]);
  const totals = useMemo(() => grandTotals(years), [years]);
  const u = unitName(unit);

  function updateYear(patch: Partial<BudgetYear>) {
    setYears((prev) => prev.map((item, idx) => (idx === activeYear ? { ...item, ...patch } : item)));
  }

  function updateRows(group: Group, rows: PersonnelRow[]) {
    updateYear({ [group]: rows } as Partial<BudgetYear>);
  }

  function updateRow(group: Group, id: number, patch: Partial<PersonnelRow>) {
    updateRows(group, year[group].map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(group: Group, id: number) {
    updateRows(group, year[group].filter((row) => row.id !== id));
  }

  function addRow(group: Group) {
    const row: PersonnelRow = { id: ++uid, name: '', base: '', months: '', counted: group === 'internal' };
    updateRows(group, [...year[group], row]);
  }

  function moveRow(group: Group, id: number, dir: -1 | 1) {
    const rows = [...year[group]];
    const index = rows.findIndex((row) => row.id === id);
    const nextIndex = index + dir;
    if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
    [rows[index], rows[nextIndex]] = [rows[nextIndex], rows[index]];
    updateRows(group, rows);
  }

  function addYear() {
    setYears((prev) => [...prev, newYear(`${prev.length + 1}차년도`)]);
    setActiveYear(years.length);
  }

  function duplicateYear() {
    const copyRows = (rows: PersonnelRow[]) => rows.map((row) => ({ ...row, id: ++uid }));
    const copy = {
      ...year,
      name: `${years.length + 1}차년도`,
      internal: copyRows(year.internal),
      external: copyRows(year.external),
      student: copyRows(year.student),
    };
    setYears((prev) => [...prev, copy]);
    setActiveYear(years.length);
  }

  function removeYear(index: number) {
    if (years.length <= 1) return;
    const next = years.filter((_, idx) => idx !== index);
    setYears(next);
    setActiveYear(Math.max(0, Math.min(activeYear, next.length - 1)));
  }

  function setPosition(group: Group, id: number, pos: string) {
    const base = positions[pos];
    updateRow(group, id, { pos, ...(base !== undefined ? { base: String(base) } : {}) });
  }

  function exportXlsx() {
    const head = [`항목 (${u})`, ...years.map((item) => item.name), '합계'];
    const rowDefs: [string, (c: ReturnType<typeof computeBudget>) => number][] = [
      ['인건비(계상)', (c) => c.personnelCounted],
      ['인건비(미계상 포함)', (c) => c.personnelAll],
      ['연구수당', (c) => c.allowance],
      ['연구활동비', (c) => c.activity],
      ['연구재료비', (c) => c.material],
      ['직접비 소계', (c) => c.direct],
      ['간접비', (c) => c.indirect],
      ['부가세', (c) => c.vatAmt],
      ['소요 총액', (c) => c.required],
      ['가용 총연구비', (c) => c.total],
      ['과부족(가용-소요)', (c) => c.diff],
    ];
    const computedYears = years.map(computeBudget);
    const aoa: (string | number)[][] = [['연구과제 예산 요약', '금액 단위', u], [], head];
    rowDefs.forEach(([label, fn]) => {
      const vals = computedYears.map(fn);
      aoa.push([label, ...vals.map((v) => Math.round(v)), Math.round(vals.reduce((a, b) => a + b, 0))]);
    });
    aoa.push([], ['[설정]']);
    aoa.push(['간접비율(%)', ...years.map((item) => parseNum(item.rateRaw)), '']);
    aoa.push(['연구수당율(%)', ...years.map((item) => parseNum(item.allowanceRateRaw)), '']);
    aoa.push(['부가세', ...years.map((item) => (item.vat ? '있음' : '없음')), '']);

    const people: (string | number)[][] = [['연차', '구분', '이름', '직위', '기준액(월)', '참여개월', '계상구분', `산출액 (${u})`]];
    years.forEach((item) => {
      item.internal.forEach((row) => people.push([item.name, '내부인건비', row.name, row.pos || '', parseNum(row.base), parseNum(row.months), row.counted ? '계상' : '미계상', rowAmount(row)]));
      item.external.forEach((row) => people.push([item.name, '외부인건비', row.name, row.pos || '', parseNum(row.base), parseNum(row.months), '계상', rowAmount(row)]));
      item.student.forEach((row) => people.push([item.name, '학생인건비', row.name, row.pos || '', parseNum(row.base), parseNum(row.months), '계상', rowAmount(row)]));
    });

    const xml = buildExcelXml([
      { name: '예산요약', rows: aoa },
      { name: '인건비', rows: people },
    ]);
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '연구과제_예산_계산결과.xls';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="hero">
          <div>
            <div className="eyebrow">Research Budget</div>
            <h1>연구과제 예산 계산기</h1>
            <p>연차별로 인건비·연구활동비·재료비를 입력하면 소요 예산과 부족분을 자동 산출합니다.</p>
          </div>
          <button className="primary" onClick={exportXlsx}>↓ 엑셀로 내보내기 <span>(전체 연차)</span></button>
        </header>

        <section className="tabs">
          {years.map((item, index) => (
            <button key={`${item.name}-${index}`} className={index === activeYear ? 'tab active' : 'tab'} onClick={() => setActiveYear(index)}>
              {item.name}
              {years.length > 1 && index === years.length - 1 ? <span className="remove" onClick={(e) => { e.stopPropagation(); removeYear(index); }}>×</span> : null}
            </button>
          ))}
          <button className="link" onClick={addYear}>+ 연차 추가</button>
          <button className="muted-link" onClick={duplicateYear}>⧉ 현재 연차 복제</button>
          <div className="grow" />
          <Segment label="금액 단위" options={[["won", "원"], ["thousand", "천원"], ["million", "백만원"]]} value={unit} onChange={(v) => setUnit(v as Unit)} />
        </section>

        <section className="card settings">
          <div className="card-title"><h2>{year.name} · 기본 설정</h2></div>
          <div className="grid three">
            <Input label="총연구비 (가용/목표)" value={year.totalRaw} onChange={(value) => updateYear({ totalRaw: value })} suffix={u} />
            <Input label="간접비율" value={year.rateRaw} onChange={(value) => updateYear({ rateRaw: value })} suffix="%" />
            <Input label="연구수당율" value={year.allowanceRateRaw} onChange={(value) => updateYear({ allowanceRateRaw: value })} suffix="%" />
            <Toggle label="부가세 여부" options={[[true, '부가세 있음'], [false, '부가세 없음']]} value={year.vat} onChange={(value) => updateYear({ vat: value as boolean })} />
            <Toggle label="간접비 계산기준" options={[["direct", '직접비 기준'], ["total", '총연구비 기준']]} value={year.basis} onChange={(value) => updateYear({ basis: value as BudgetYear['basis'] })} />
          </div>
          <div className="preset-row">
            {presets.map((preset) => <button key={preset.label} onClick={() => updateYear({ rateRaw: preset.rate, vat: preset.vat })}>{preset.label}</button>)}
          </div>
        </section>

        <PeopleSection title="내부인건비" rows={year.internal} group="internal" onAdd={addRow} onRemove={removeRow} onMove={moveRow} onUpdate={updateRow} onPosition={setPosition} />
        <PeopleSection title="외부인건비" rows={year.external} group="external" onAdd={addRow} onRemove={removeRow} onMove={moveRow} onUpdate={updateRow} onPosition={setPosition} />
        <PeopleSection title="학생인건비" rows={year.student} group="student" onAdd={addRow} onRemove={removeRow} onMove={moveRow} onUpdate={updateRow} onPosition={setPosition} />

        <section className="card costs">
          <h2>직접비 항목</h2>
          <div className="grid two">
            <Input label="연구활동비" value={year.activityRaw} onChange={(value) => updateYear({ activityRaw: value })} suffix={u} />
            <Input label="연구재료비" value={year.materialRaw} onChange={(value) => updateYear({ materialRaw: value })} suffix={u} />
          </div>
        </section>

        <section className="summary">
          <div className="summary-grid">
            <Stat label="인건비(계상)" value={computed.personnelCounted} />
            <Stat label="연구수당" value={computed.allowance} />
            <Stat label="직접비 소계" value={computed.direct} />
            <Stat label="간접비" value={computed.indirect} />
            {year.vat ? <Stat label="부가세" value={computed.vatAmt} /> : null}
            <Stat label="소요 총액" value={computed.required} strong />
            <Stat label="가용 총연구비" value={computed.total} />
          </div>
          <div className={computed.diff < 0 ? 'balance danger' : 'balance'}>
            <span>{computed.diff < 0 ? '부족분 (모자란 예산)' : '여유분 (남는 예산)'}</span>
            <strong>{formatNumber(Math.abs(computed.diff))}</strong>
            <small>소요 총액 = 직접비 + 간접비{year.vat ? ' + 부가세' : ''} · {computed.total > 0 ? (computed.diff < 0 ? '가용 예산 초과' : '가용 예산 내') : '가용 총연구비 미입력'}</small>
            {computed.total > 0 && Math.abs(computed.diff) >= 1 ? <button onClick={() => updateYear({ activityRaw: String(activityToBalance(year)) })}>↳ 연구활동비로 맞추기 (잔액 0으로)</button> : null}
          </div>
        </section>

        <section className="grand card">
          <div><strong>전체 연차 합계</strong> <span>({years.length}개 연차 · {u})</span></div>
          <Stat label="소요 총액" value={totals.required} strong />
          <Stat label="가용 총연구비" value={totals.total} />
          <Stat label={totals.diff < 0 ? '총 부족분' : '총 여유분'} value={Math.abs(totals.diff)} strong danger={totals.diff < 0} />
        </section>

        <p className="footnote">* 인건비를 수정하면 연구수당·직접비·간접비·소요 총액·부족분이 즉시 재계산됩니다. 단위 변경 시 입력값은 그대로 유지됩니다.</p>
      </div>
    </main>
  );
}

function Input({ label, value, suffix, onChange }: { label: string; value: string; suffix: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><div><input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" /><em>{suffix}</em></div></label>;
}

function Segment({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string; onChange: (value: string) => void }) {
  return <div className="segment"><span>{label}</span><div>{options.map(([id, text]) => <button key={id} className={id === value ? 'on' : ''} onClick={() => onChange(id)}>{text}</button>)}</div></div>;
}

function Toggle({ label, options, value, onChange }: { label: string; options: [string | boolean, string][]; value: string | boolean; onChange: (value: string | boolean) => void }) {
  return <div className="toggle"><span>{label}</span><div>{options.map(([id, text]) => <button key={String(id)} className={id === value ? 'on' : ''} onClick={() => onChange(id)}>{text}</button>)}</div></div>;
}

function PeopleSection({ title, rows, group, onAdd, onRemove, onMove, onUpdate, onPosition }: {
  title: string;
  rows: PersonnelRow[];
  group: Group;
  onAdd: (group: Group) => void;
  onRemove: (group: Group, id: number) => void;
  onMove: (group: Group, id: number, dir: -1 | 1) => void;
  onUpdate: (group: Group, id: number, patch: Partial<PersonnelRow>) => void;
  onPosition: (group: Group, id: number, pos: string) => void;
}) {
  return <section className="card people"><div className="card-title"><h2>{title}</h2><button onClick={() => onAdd(group)}>+ 행 추가</button></div>
    <div className="table-wrap"><table><thead><tr><th>이름</th><th>직위/과정</th><th>기준액(월)</th><th>참여개월</th>{group === 'internal' ? <th>계상구분</th> : null}<th>산출액</th><th>순서</th><th /></tr></thead><tbody>
      {rows.length === 0 ? <tr><td className="empty" colSpan={group === 'internal' ? 8 : 7}>아직 입력된 항목이 없습니다.</td></tr> : rows.map((row) => <tr key={row.id}>
        <td><input value={row.name} onChange={(e) => onUpdate(group, row.id, { name: e.target.value })} placeholder="이름" /></td>
        <td><select value={row.pos || ''} onChange={(e) => onPosition(group, row.id, e.target.value)}><option value="">직접 입력</option>{Object.keys(positions).map((pos) => <option key={pos} value={pos}>{pos}</option>)}</select></td>
        <td><input inputMode="decimal" value={row.base} onChange={(e) => onUpdate(group, row.id, { base: e.target.value })} /></td>
        <td><input inputMode="decimal" value={row.months} onChange={(e) => onUpdate(group, row.id, { months: e.target.value })} /></td>
        {group === 'internal' ? <td><div className="mini"><button className={row.counted ? 'on' : ''} onClick={() => onUpdate(group, row.id, { counted: true })}>계상</button><button className={!row.counted ? 'on' : ''} onClick={() => onUpdate(group, row.id, { counted: false })}>미계상</button></div></td> : null}
        <td className={group === 'internal' && !row.counted ? 'muted amount' : 'amount'}>{formatNumber(rowAmount(row))}</td>
        <td><div className="icon-row"><button onClick={() => onMove(group, row.id, -1)}>↑</button><button onClick={() => onMove(group, row.id, 1)}>↓</button></div></td>
        <td><button className="danger-text" onClick={() => onRemove(group, row.id)}>삭제</button></td>
      </tr>)}</tbody></table></div></section>;
}

function Stat({ label, value, strong = false, danger = false }: { label: string; value: number; strong?: boolean; danger?: boolean }) {
  return <div className={danger ? 'stat danger-text' : 'stat'}><span>{label}</span><strong className={strong ? 'big' : ''}>{formatNumber(value)}</strong></div>;
}

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildExcelXml(sheets: { name: string; rows: (string | number)[][] }[]) {
  const worksheets = sheets.map(({ name, rows }) => `
    <Worksheet ss:Name="${escapeXml(name)}">
      <Table>
        ${rows.map((row) => `<Row>${row.map((cell) => {
          const type = typeof cell === 'number' ? 'Number' : 'String';
          return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
        }).join('')}</Row>`).join('\n')}
      </Table>
    </Worksheet>`).join('\n');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${worksheets}
</Workbook>`;
}

createRoot(document.getElementById('root')!).render(<App />);
