export type ChartDatum = {
  label: string;
  value: number;
};
export type ChartProps = {
  title: string;
  unit?: string;
  data: readonly ChartDatum[];
};
