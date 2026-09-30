export function Logo() {
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- a static SVG gains nothing from next/image
    <img
      src="/icon.svg"
      alt=""
      width={2020}
      height={1130}
      draggable={false}
      className="h-3.5 w-auto select-none"
    />
  );
}
