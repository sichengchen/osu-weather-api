declare module "d3" {
  export function extent(values: number[]): [number | undefined, number | undefined];

  export type LinearScale = {
    domain(domain: [number, number]): LinearScale;
    range(range: [number, number]): LinearScale;
    (value: number): number;
  };

  export function scaleLinear(): LinearScale;

  export type LineGenerator<T> = {
    x(accessor: (point: T, index: number) => number): LineGenerator<T>;
    y(accessor: (point: T, index: number) => number): LineGenerator<T>;
    (data: T[]): string | null;
  };

  export function line<T>(): LineGenerator<T>;
}
