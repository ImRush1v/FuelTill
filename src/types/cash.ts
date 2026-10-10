export type Denomination = { label: string; cents: number; kind: 'coin' | 'note' };
export const NZD: Denomination[] = [
  { label: '10c', cents: 10, kind: 'coin' }, { label: '20c', cents: 20, kind: 'coin' },
  { label: '50c', cents: 50, kind: 'coin' }, { label: '$1', cents: 100, kind: 'coin' },
  { label: '$2', cents: 200, kind: 'coin' }, { label: '$5', cents: 500, kind: 'note' },
  { label: '$10', cents: 1000, kind: 'note' }, { label: '$20', cents: 2000, kind: 'note' },
  { label: '$50', cents: 5000, kind: 'note' }, { label: '$100', cents: 10000, kind: 'note' }
];
export type Count = number[];
