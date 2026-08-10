import { Result } from 'antd';

/** Tela de Início do shell autenticado, exibida após o login. */
export function PlaceholderPage({ title }: { title: string }) {
  return <Result icon={<img src="/favicon.png" alt="" width={72} />} title={title} />;
}
