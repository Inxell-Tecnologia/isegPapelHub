// Moldura escura contida (design.md D1/D2): a arte fonte não tem fundo
// transparente, então a logomarca sempre vive dentro de um contêiner escuro
// próprio, dimensionado por quem a hospeda — nunca solta sobre fundo claro.
const LOGO_ASPECT_RATIO = 301 / 502;

interface BrandMarkProps {
  height: number;
  /**
   * Presente: a imagem carrega o nome acessível da marca (ex. shell expandido,
   * onde não há texto irmão — design.md D7). Ausente: modo decorativo
   * (`aria-hidden`, ex. login, onde o heading ao lado já é o nome acessível).
   */
  alt?: string;
}

export function BrandMark({ height, alt }: BrandMarkProps) {
  const width = Math.round(height * LOGO_ASPECT_RATIO);

  return (
    <span
      aria-hidden={alt ? undefined : true}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#141414',
        flexShrink: 0,
      }}
    >
      <img
        src="/logo-papelhub.jpg"
        alt={alt ?? ''}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </span>
  );
}
