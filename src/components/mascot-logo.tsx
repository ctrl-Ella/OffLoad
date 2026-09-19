import Image from "next/image";

type MascotLogoProps = {
  className?: string;
  decorative?: boolean;
};

export function MascotLogo({ className = "", decorative = false }: MascotLogoProps) {
  const alt = decorative ? "" : "Mia, la asistente de Offload";

  return (
    <span className={`mascot-logo ${className}`}>
      <Image className="mascot-animated" src="/mia-logo.gif" width={360} height={400} alt={alt} unoptimized />
      <Image className="mascot-still" src="/mia-logo.png" width={360} height={400} alt={alt} unoptimized />
    </span>
  );
}
